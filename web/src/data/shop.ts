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
import { getDb, isDemo, saveDb } from '../demo/demo';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Lot {
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
  company: { name: string; is_verified: boolean } | null;
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

const LOT_SELECT = `
  id, sku, title, description, base_price, msrp_reference, currency,
  stock_quantity, status, is_verified, packaging_state, product_state,
  unit_count, total_weight_kg, length_cm, width_cm, height_cm,
  warehouse_zone, is_featured, published_at,
  circularity_percent, waste_avoided_kg,
  warehouses (code, name, city),
  brands (name),
  companies (name, is_verified),
  lot_categories (categories (id, name, slug)),
  lot_images (storage_path, is_primary, sort_order),
  reviews (rating)
`;

export function toLot(row: Record<string, unknown>): Lot {
  const r = row as Record<string, any>;
  const cats: Category[] = (r.lot_categories ?? [])
    .map((lc: any) => lc.categories)
    .filter(Boolean);
  const images: any[] = [...(r.lot_images ?? [])].sort(
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
    .storage.from('lot-images')
    .getPublicUrl(path);
  return data.publicUrl;
}

export function applyFilters(lots: Lot[], f: Filters): Lot[] {
  // La búsqueda se sanitiza aquí (el input conserva el texto en bruto).
  const q = sanitizeText(f.q, LIMITS.search).toLowerCase();
  // NaN/negativos/infinitos se descartan (fail-closed a "sin filtro" solo en vacío).
  const minP = parsePrice(f.minPrice);
  const maxP = parsePrice(f.maxPrice);
  const minD = parseDiscount(f.minDiscount);
  const out = lots.filter((l) => {
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
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo()) {
      const all = getDb().lots
        .filter((l: any) => l.status === 'published' && l.stock_quantity > 0)
        .map((r: any) => toLot(r as Record<string, unknown>));
      setLots(all);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    requireSupabase()
      .from('lots')
      .select(LOT_SELECT)
      .eq('status', 'published')
      .gt('stock_quantity', 0)
      .order('published_at', { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setLots(((data ?? []) as Record<string, unknown>[]).map(toLot));
        setLoading(false);
      });
  }, []);

  return {
    lots: applyFilters(lots, filters),
    total: lots.length,
    loading,
    error,
    configured: isSupabaseConfigured,
  };
}

export function useLot(id: string | undefined) {
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El :id viene de la URL (control del usuario): exige UUID antes de consultar.
    if (!id || !isUuid(id)) {
      if (id) setError('Identificador de lote inválido.');
      setLoading(false);
      return;
    }
    if (isDemo()) {
      const found = getDb().lots.find((l: any) => l.id === id);
      if (found) setLot(toLot(found as Record<string, unknown>));
      else setError('Lote no encontrado.');
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('lots')
      .select(LOT_SELECT)
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else if (data) setLot(toLot(data as unknown as Record<string, unknown>));
        setLoading(false);
      });
  }, [id]);

  return { lot, loading, error, configured: isSupabaseConfigured };
}

export function useLotsByIds(ids: string[]) {
  const [map, setMap] = useState<Record<string, Lot>>({});
  const [loading, setLoading] = useState(ids.length > 0);
  const key = [...ids].sort().join(',');

  useEffect(() => {
    // Los ids pueden venir de localStorage (manipulable): filtra a UUIDs.
    const safeIds = ids.filter(isUuid);
    if (safeIds.length === 0) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      const m: Record<string, Lot> = {};
      for (const row of getDb().lots as unknown as Record<string, unknown>[]) {
        const lot = toLot(row);
        if (safeIds.includes(lot.id)) m[lot.id] = lot;
      }
      setMap(m);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('lots')
      .select(LOT_SELECT)
      .in('id', safeIds)
      .then(({ data }) => {
        const m: Record<string, Lot> = {};
        for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
          const lot = toLot(row);
          m[lot.id] = lot;
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
    if (isDemo()) {
      setItems(getDb().categories);
      return;
    }
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
    if (isDemo()) {
      setItems(getDb().brands);
      return;
    }
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

export function usePriceTiers(lotId: string | undefined) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  useEffect(() => {
    if (!lotId) return;
    if (isDemo()) {
      setTiers(
        getDb().tiers
          .filter((t: any) => t.lot_id === lotId)
          .map((t: any) => ({ id: t.id, min_quantity: t.min_quantity, unit_price: t.unit_price })),
      );
      return;
    }
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('lot_price_tiers')
      .select('id, min_quantity, unit_price')
      .eq('lot_id', lotId)
      .order('min_quantity')
      .then(({ data }) =>
        setTiers(
          ((data ?? []) as any[]).map((t) => ({
            ...t,
            unit_price: Number(t.unit_price),
          })),
        ),
      );
  }, [lotId]);
  return tiers;
}

export async function fetchTiers(lotIds: string[]): Promise<Record<string, PriceTier[]>> {
  if (lotIds.length === 0) return {};
  if (isDemo()) {
    const map: Record<string, PriceTier[]> = {};
    for (const t of getDb().tiers as any[]) {
      if (lotIds.includes(t.lot_id)) {
        (map[t.lot_id] ??= []).push({
          id: t.id,
          min_quantity: t.min_quantity,
          unit_price: t.unit_price,
        });
      }
    }
    return map;
  }
  if (!isSupabaseConfigured) return {};
  const { data } = await requireSupabase()
    .from('lot_price_tiers')
    .select('lot_id, min_quantity, unit_price')
    .in('lot_id', lotIds.filter(isUuid));
  const map: Record<string, PriceTier[]> = {};
  for (const t of (data ?? []) as any[]) {
    (map[t.lot_id] ??= []).push({ id: '', min_quantity: t.min_quantity, unit_price: Number(t.unit_price) });
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

export function useSimilarLots(lot: Lot | null) {
  const [items, setItems] = useState<Lot[]>([]);
  useEffect(() => {
    if (!lot) return;
    const catIds = lot.categories.map((c) => c.id);
    if (catIds.length === 0) return;
    if (isDemo()) {
      const all = (getDb().lots as unknown as Record<string, unknown>[]).map(toLot);
      setItems(
        all
          .filter(
            (l) =>
              l.id !== lot.id &&
              l.status === 'published' &&
              l.stock_quantity > 0 &&
              l.categories.some((c) => catIds.includes(c.id)),
          )
          .slice(0, 4),
      );
      return;
    }
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('lots')
      .select(LOT_SELECT)
      .eq('status', 'published')
      .gt('stock_quantity', 0)
      .neq('id', lot.id)
      .limit(20)
      .then(({ data }) => {
        const all = ((data ?? []) as Record<string, unknown>[]).map(toLot);
        setItems(
          all.filter((l) => l.categories.some((c) => catIds.includes(c.id))).slice(0, 4),
        );
      });
  }, [lot]);
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
    if (isDemo()) {
      setIds(new Set(getDb().favorites));
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await requireSupabase()
      .from('favorites')
      .select('lot_id')
      .eq('profile_id', userId);
    setIds(new Set(((data ?? []) as { lot_id: string }[]).map((r) => r.lot_id)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (lotId: string) => {
      if (!userId) return;
      if (isDemo()) {
        const db = getDb();
        db.favorites = ids.has(lotId)
          ? db.favorites.filter((x) => x !== lotId)
          : [...db.favorites, lotId];
        saveDb(db);
        await refresh();
        return;
      }
      const sb = requireSupabase();
      if (ids.has(lotId)) {
        await sb
          .from('favorites')
          .delete()
          .eq('profile_id', userId)
          .eq('lot_id', lotId);
      } else {
        await sb.from('favorites').insert({ profile_id: userId, lot_id: lotId });
      }
      await refresh();
    },
    [ids, userId, refresh],
  );

  return { ids, loading, toggle, refresh };
}

export function useFavoriteLots(userId: string | undefined) {
  const { ids, loading, toggle } = useFavorites(userId);
  const { map, loading: lotsLoading } = useLotsByIds([...ids]);
  const lots = [...ids].map((id) => map[id]).filter(Boolean);
  return { lots, loading: loading || lotsLoading, toggle };
}

export function useReviews(lotId: string | undefined) {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(Boolean(lotId));

  useEffect(() => {
    if (!lotId) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      setItems(
        getDb()
          .reviews.filter((r: any) => r.lot_id === lotId)
          .map((r: any) => ({
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
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('reviews')
      .select('id, rating, title, comment, is_verified_purchase, created_at, profiles (first_name)')
      .eq('lot_id', lotId)
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
  }, [lotId]);

  return { items, loading };
}

export async function addReview(input: {
  lotId: string;
  profileId: string;
  orderId: string | null;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
}) {
  if (isDemo()) {
    const db = getDb();
    db.reviews.unshift({
      id: `demo-rev-${Date.now()}`,
      lot_id: input.lotId,
      rating: input.rating,
      title: input.title || null,
      comment: input.comment || null,
      is_verified_purchase: input.verified,
      created_at: new Date().toISOString(),
      profiles: { first_name: db.profile.first_name },
    });
    const lot = db.lots.find((l: any) => l.id === input.lotId);
    if (lot) lot.reviews = [...(lot.reviews ?? []), { rating: input.rating }];
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('reviews').insert({
    lot_id: input.lotId,
    profile_id: input.profileId,
    order_id: input.orderId,
    rating: input.rating,
    title: input.title || null,
    comment: input.comment || null,
    is_verified_purchase: input.verified,
  });
  if (error) throw error;
}
