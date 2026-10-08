import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { discountPct } from '../lib/format';
import {
  LIMITS,
  isUuid,
  parseDiscount,
  parsePrice,
  sanitizeText,
} from '../lib/validation';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  base_price: number;
  msrp_reference: number | null;
  currency: string;
  stock_quantity: number;
  status: string;
  is_verified: boolean;
  packaging_state: string;
  product_state: string;
  unit_count: number;
  total_weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  warehouse_zone: string | null;
  is_featured: boolean;
  published_at: string | null;
  circularity_percent: number | null;
  waste_avoided_kg: number | null;
  warehouse: { code: string; name: string; city: string } | null;
  brand: { name: string } | null;
  company: { id: string; name: string; is_verified: boolean } | null;
  categories: Category[];
  imageUrls: string[];
  avgRating: number | null;
  reviewsCount: number;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  author: string;
}

export interface Filters {
  q: string;
  categoryId: string;
  brandId: string;
  minPrice: string;
  maxPrice: string;
  packaging: string;
  verifiedOnly: boolean;
  minDiscount: string;
  sort: 'relevant' | 'price_asc' | 'price_desc' | 'newest';
}

export const emptyFilters: Filters = {
  q: '',
  categoryId: '',
  brandId: '',
  minPrice: '',
  maxPrice: '',
  packaging: '',
  verifiedOnly: false,
  minDiscount: '',
  sort: 'relevant',
};

const PRODUCT_SELECT = `
  id, sku, title, description, base_price, msrp_reference, currency,
  stock_quantity, status, is_verified, packaging_state, product_state,
  unit_count, total_weight_kg, length_cm, width_cm, height_cm,
  warehouse_zone, is_featured, published_at,
  circularity_percent, waste_avoided_kg,
  warehouses (code, name, city),
  brands (name),
  companies (id, name, is_verified),
  product_categories (categories (id, name, slug)),
  product_images (storage_path, is_primary, sort_order),
  reviews (rating)
`;

export function toProduct(row: Record<string, unknown>): Product {
  const r = row as Record<string, any>;
  const cats: Category[] = (r.product_categories ?? [])
    .map((lc: any) => lc.categories)
    .filter(Boolean);
  const images: any[] = [...(r.product_images ?? [])].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  const ratings: number[] = (r.reviews ?? []).map((x: any) => x.rating);
  return {
    id: r.id,
    sku: r.sku,
    title: r.title,
    description: r.description,
    base_price: Number(r.base_price),
    msrp_reference: r.msrp_reference == null ? null : Number(r.msrp_reference),
    currency: r.currency,
    stock_quantity: r.stock_quantity,
    status: r.status,
    is_verified: r.is_verified,
    packaging_state: r.packaging_state,
    product_state: r.product_state,
    unit_count: r.unit_count,
    total_weight_kg: Number(r.total_weight_kg),
    length_cm: r.length_cm == null ? null : Number(r.length_cm),
    width_cm: r.width_cm == null ? null : Number(r.width_cm),
    height_cm: r.height_cm == null ? null : Number(r.height_cm),
    warehouse_zone: r.warehouse_zone,
    is_featured: r.is_featured,
    published_at: r.published_at,
    circularity_percent:
      r.circularity_percent == null ? null : Number(r.circularity_percent),
    waste_avoided_kg:
      r.waste_avoided_kg == null ? null : Number(r.waste_avoided_kg),
    warehouse: r.warehouses ?? null,
    brand: r.brands ?? null,
    company: r.companies ?? null,
    categories: cats,
    imageUrls: images.map((im) => publicImageUrl(im.storage_path)),
    avgRating: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null,
    reviewsCount: ratings.length,
  };
}

export function publicImageUrl(path: string): string {
  if (!isSupabaseConfigured) return '';
  const { data } = requireSupabase()
    .storage.from('product-images')
    .getPublicUrl(path);
  return data.publicUrl;
}

export function applyFilters(products: Product[], f: Filters): Product[] {
  // La búsqueda se sanitiza aquí (el input conserva el texto en bruto).
  const q = sanitizeText(f.q, LIMITS.search).toLowerCase();
  // NaN/negativos/infinitos se descartan (fail-closed a "sin filtro" solo en vacío).
  const minP = parsePrice(f.minPrice);
  const maxP = parsePrice(f.maxPrice);
  const minD = parseDiscount(f.minDiscount);
  const out = products.filter((l) => {
    if (q && !`${l.title} ${l.sku} ${l.description ?? ''}`.toLowerCase().includes(q))
      return false;
    if (f.categoryId && !l.categories.some((c) => c.id === f.categoryId))
      return false;
    if (f.brandId && l.brand?.name !== f.brandId) return false;
    if (minP != null && l.base_price < minP) return false;
    if (maxP != null && l.base_price > maxP) return false;
    if (f.packaging && l.packaging_state !== f.packaging) return false;
    if (f.verifiedOnly && !l.is_verified) return false;
    if (minD != null) {
      const d = discountPct(l.base_price, l.msrp_reference) ?? 0;
      if (d < minD) return false;
    }
    return true;
  });
  switch (f.sort) {
    case 'price_asc':
      return out.sort((a, b) => a.base_price - b.base_price);
    case 'price_desc':
      return out.sort((a, b) => b.base_price - a.base_price);
    case 'newest':
      return out.sort((a, b) =>
        (b.published_at ?? '').localeCompare(a.published_at ?? ''),
      );
    default:
      return out.sort(
        (a, b) =>
          Number(b.is_featured) - Number(a.is_featured) ||
          (b.published_at ?? '').localeCompare(a.published_at ?? ''),
      );
  }
}

export function useCatalog(filters: Filters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    requireSupabase()
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'published')
      .gt('stock_quantity', 0)
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setProducts(((data ?? []) as Record<string, unknown>[]).map(toProduct));
        setLoading(false);
      });
  }, []);

  return {
    products: applyFilters(products, filters),
    total: products.length,
    loading,
    error,
    configured: isSupabaseConfigured,
  };
}

export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El :id viene de la URL (control del usuario): exige UUID antes de consultar.
    if (!id || !isUuid(id)) {
      if (id) setError('Identificador de producto inválido.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else if (data) setProduct(toProduct(data as unknown as Record<string, unknown>));
        setLoading(false);
      });
  }, [id]);

  return { product, loading, error, configured: isSupabaseConfigured };
}

export function useProductsByIds(ids: string[]) {
  const [map, setMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(ids.length > 0);
  const key = [...ids].sort().join(',');

  useEffect(() => {
    // Los ids pueden venir de localStorage (manipulable): filtra a UUIDs.
    const safeIds = ids.filter(isUuid);
    if (safeIds.length === 0) {
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('products')
      .select(PRODUCT_SELECT)
      .in('id', safeIds)
      .then(({ data }) => {
        const m: Record<string, Product> = {};
        for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
          const product = toProduct(row);
          m[product.id] = product;
        }
        setMap(m);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { map, loading, configured: isSupabaseConfigured };
}

export function useCategories() {
  const [items, setItems] = useState<Category[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setItems((data ?? []) as Category[]));
  }, []);
  return items;
}

export function useBrands() {
  const [items, setItems] = useState<Brand[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('brands')
      .select('id, name')
      .order('name')
      .then(({ data }) => setItems((data ?? []) as Brand[]));
  }, []);
  return items;
}

export interface PriceTier {
  id: string;
  min_quantity: number;
  unit_price: number;
}

export function usePriceTiers(productId: string | undefined) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  useEffect(() => {
    if (!productId) return;
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('product_price_tiers')
      .select('id, min_quantity, unit_price')
      .eq('product_id', productId)
      .order('min_quantity')
      .then(({ data }) =>
        setTiers(
          ((data ?? []) as any[]).map((t) => ({
            ...t,
            unit_price: Number(t.unit_price),
          })),
        ),
      );
  }, [productId]);
  return tiers;
}

export async function fetchTiers(productIds: string[]): Promise<Record<string, PriceTier[]>> {
  if (productIds.length === 0) return {};
  if (!isSupabaseConfigured) return {};
  const { data } = await requireSupabase()
    .from('product_price_tiers')
    .select('product_id, min_quantity, unit_price')
    .in('product_id', productIds.filter(isUuid));
  const map: Record<string, PriceTier[]> = {};
  for (const t of (data ?? []) as any[]) {
    (map[t.product_id] ??= []).push({ id: '', min_quantity: t.min_quantity, unit_price: Number(t.unit_price) });
  }
  return map;
}

/** Mejor precio por volumen para la cantidad (revendedores). */
export function tierPrice(tiers: PriceTier[], qty: number, base: number): number {
  let best = base;
  for (const t of tiers) {
    if (qty >= t.min_quantity && t.unit_price < best) best = t.unit_price;
  }
  return best;
}

export function useSimilarProducts(product: Product | null) {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    if (!product) return;
    const catIds = product.categories.map((c) => c.id);
    if (catIds.length === 0) return;
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'published')
      .gt('stock_quantity', 0)
      .neq('id', product.id)
      .limit(20)
      .then(({ data }) => {
        const all = ((data ?? []) as Record<string, unknown>[]).map(toProduct);
        setItems(
          all.filter((l) => l.categories.some((c) => catIds.includes(c.id))).slice(0, 4),
        );
      });
  }, [product]);
  return items;
}

export function useFavorites(userId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await requireSupabase()
      .from('favorites')
      .select('product_id')
      .eq('profile_id', userId);
    setIds(new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!userId) return;
      const sb = requireSupabase();
      if (ids.has(productId)) {
        await sb
          .from('favorites')
          .delete()
          .eq('profile_id', userId)
          .eq('product_id', productId);
      } else {
        await sb.from('favorites').insert({ profile_id: userId, product_id: productId });
      }
      await refresh();
    },
    [ids, userId, refresh],
  );

  return { ids, loading, toggle, refresh };
}

export function useFavoriteProducts(userId: string | undefined) {
  const { ids, loading, toggle } = useFavorites(userId);
  const { map, loading: productsLoading } = useProductsByIds([...ids]);
  const products = [...ids].map((id) => map[id]).filter(Boolean);
  return { products, loading: loading || productsLoading, toggle };
}

export function useReviews(productId: string | undefined) {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('reviews')
      .select('id, rating, title, comment, is_verified_purchase, created_at, profiles (first_name)')
      .eq('product_id', productId)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(
          ((data ?? []) as any[]).map((r) => ({
            id: r.id,
            rating: r.rating,
            title: r.title,
            comment: r.comment,
            is_verified_purchase: r.is_verified_purchase,
            created_at: r.created_at,
            author: r.profiles?.first_name ?? 'Comprador',
          })),
        );
        setLoading(false);
      });
  }, [productId]);

  return { items, loading };
}

export async function addReview(input: {
  productId: string;
  profileId: string;
  orderId: string | null;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
}) {
  const { error } = await requireSupabase().from('reviews').insert({
    product_id: input.productId,
    profile_id: input.profileId,
    order_id: input.orderId,
    rating: input.rating,
    title: input.title || null,
    comment: input.comment || null,
    is_verified_purchase: input.verified,
  });
  if (error) throw error;
}

export interface TimelineEvent {
  id: string;
  stage: string;
  detail: string | null;
  actor_label: string | null;
  created_at: string;
}

export function useProductTimeline(productId: string | undefined) {
  const [items, setItems] = useState<TimelineEvent[]>([]);
  useEffect(() => {
    if (!productId || !isUuid(productId) || !isSupabaseConfigured) return;
    requireSupabase()
      .from('product_timeline')
      .select('id, stage, detail, actor_label, created_at')
      .eq('product_id', productId)
      .order('created_at')
      .then(({ data }) => {
        if (data) setItems(data as TimelineEvent[]);
      });
  }, [productId]);
  return items;
}
