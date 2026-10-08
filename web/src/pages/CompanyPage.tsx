import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { ConfigNotice, EmptyState, ProductCard } from '../components/ui';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { isUuid } from '../lib/validation';
import { toProduct, type Product } from '../data/shop';

interface CompanyPublic {
  id: string;
  name: string;
  city: string | null;
  is_verified: boolean;
  packages_received: number;
  products_published: number;
  units_sold: number;
}

export default function CompanyPage() {
  const { id } = useParams();
  const [company, setCompany] = useState<CompanyPublic | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || !isUuid(id)) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = requireSupabase();
    Promise.all([
      sb.from('v_company_public').select('*').eq('id', id).maybeSingle(),
      sb
        .from('products')
        .select(
          'id, sku, title, description, base_price, msrp_reference, currency, stock_quantity, status, is_verified, packaging_state, product_state, unit_count, total_weight_kg, length_cm, width_cm, height_cm, warehouse_zone, is_featured, published_at, circularity_percent, waste_avoided_kg, warehouses (code, name, city), brands (name), companies (id, name, is_verified), product_categories (categories (id, name, slug)), product_images (storage_path, is_primary, sort_order), reviews (rating)',
        )
        .eq('company_id', id)
        .eq('status', 'published')
        .gt('stock_quantity', 0)
        .order('published_at', { ascending: false })
        .limit(12),
    ]).then(([c, p]) => {
      if (!c.data) setNotFound(true);
      else setCompany(c.data as CompanyPublic);
      if (!p.error) setProducts(((p.data ?? []) as any[]).map((r) => toProduct(r)));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Cargando empresa…</p>
      </Layout>
    );
  }
  if (!isSupabaseConfigured) {
    return (
      <Layout>
        <ConfigNotice />
      </Layout>
    );
  }
  if (notFound || !company) {
    return (
      <Layout>
        <EmptyState title="Empresa no encontrada" text="Puede no estar verificada o ya no existe." />
      </Layout>
    );
  }

  const stats: [string, string][] = [
    [String(company.packages_received), 'paquetes entregados'],
    [String(company.products_published), 'productos publicados'],
    [String(company.units_sold), 'unidades recirculadas'],
  ];

  return (
    <Layout>
      <p className="text-sm text-slate-500 mb-4">
        <Link to="/catalogo" className="hover:underline">Catálogo</Link> /{' '}
        <span className="text-brand-950 font-medium">Empresas proveedoras</span>
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-extrabold tracking-tight text-brand-950">{company.name}</h1>
        {company.is_verified && (
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded-full px-2.5 py-1">
            ✓ Verificada
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">{company.city ?? 'Chile'} · Empresa proveedora de RecuperaPack</p>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        {stats.map(([n, label]) => (
          <div key={label} className="rounded-2xl bg-white border border-slate-200 p-5 text-center shadow-sm">
            <dd className="text-2xl font-extrabold text-brand-950">{n}</dd>
            <dd className="text-xs text-slate-500 uppercase tracking-wider mt-1">{label}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">Productos de esta empresa</h2>
          <Link to="/catalogo" className="text-sm font-semibold text-accent-600 hover:underline">
            Ver catálogo →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Sin productos publicados por ahora.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
