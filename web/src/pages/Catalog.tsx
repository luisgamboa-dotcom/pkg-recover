import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { ConfigNotice, EmptyState, ProductCard, ProductCardSkeleton, PageHeader } from '../components/ui';
import { emptyFilters, useBrands, useCatalog, useCategories, type Filters } from '../data/shop';
import { useActiveAuctions, useSavedFilters } from '../data/buying';
import { useAuth } from '../auth/AuthContext';
import { clp } from '../lib/format';
import { LIMITS } from '../lib/validation';

export default function Catalog() {
  const [f, setF] = useState<Filters>(emptyFilters);
  const { products, total, loading, error, configured } = useCatalog(f);
  const categories = useCategories();
  const brands = useBrands();
  const auctions = useActiveAuctions();
  const { user } = useAuth();
  const { items: saved, save: saveFilter, remove: removeFilter } = useSavedFilters(user?.id);
  const [filterName, setFilterName] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const suggestions =
    f.q.trim().length >= 2
      ? products.filter(
          (p) =>
            p.title.toLowerCase().includes(f.q.trim().toLowerCase()) ||
            p.sku.toLowerCase().includes(f.q.trim().toLowerCase()),
        ).slice(0, 6)
      : [];

  return (
    <Layout>
      <PageHeader
        title="Catálogo de productos"
        subtitle={`${total} productos publicados · precios en CLP con IVA calculado en caja`}
      />
      {!configured && (
        <div className="mb-4">
          <ConfigNotice />
        </div>
      )}

      {/* Búsqueda y filtros (prompt §4) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <input
            className="field-input"
            maxLength={LIMITS.search}
            placeholder="Buscar por nombre o SKU…"
            value={f.q}
            onChange={(e) => {
              set('q', e.target.value);
              setShowSuggest(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            aria-label="Buscar productos"
          />
          {showSuggest && suggestions.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/productos/${p.id}`}
                    className="flex justify-between gap-2 px-4 py-2.5 text-sm hover:bg-brand-50"
                  >
                    <span className="font-semibold text-brand-950 truncate">{p.title}</span>
                    <span className="text-slate-500 whitespace-nowrap">{clp(p.base_price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <select
          className="field-input"
          value={f.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="field-input"
          value={f.sort}
          onChange={(e) => set('sort', e.target.value as Filters['sort'])}
          aria-label="Ordenar"
        >
          <option value="relevant">Relevancia</option>
          <option value="newest">Novedades</option>
          <option value="price_asc">Menor precio</option>
          <option value="price_desc">Mayor precio</option>
        </select>
        <select
          className="field-input"
          value={f.brandId}
          onChange={(e) => set('brandId', e.target.value)}
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="field-input"
            type="number"
            min={0}
            placeholder="Precio mín."
            value={f.minPrice}
            onChange={(e) => set('minPrice', e.target.value)}
            aria-label="Precio mínimo"
          />
          <input
            className="field-input"
            type="number"
            min={0}
            placeholder="Precio máx."
            value={f.maxPrice}
            onChange={(e) => set('maxPrice', e.target.value)}
            aria-label="Precio máximo"
          />
        </div>
        <select
          className="field-input"
          value={f.packaging}
          onChange={(e) => set('packaging', e.target.value)}
          aria-label="Estado del empaque"
        >
          <option value="">Empaque: todos</option>
          <option value="original">Original</option>
          <option value="damaged">Dañada</option>
          <option value="no_box">Sin caja</option>
        </select>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[#1a365d]"
              checked={f.verifiedOnly}
              onChange={(e) => set('verifiedOnly', e.target.checked)}
            />
            Verificados
          </label>
          <input
            className="field-input"
            type="number"
            min={0}
            max={90}
            placeholder="Desc. mín. %"
            value={f.minDiscount}
            onChange={(e) => set('minDiscount', e.target.value)}
            aria-label="Descuento mínimo"
          />
        </div>
      </div>

      {auctions.length > 0 && (
        <section className="mb-6 rounded-2xl border-2 border-accent-500 bg-accent-500/5 p-4">
          <h2 className="font-extrabold text-brand-950">🔨 Subastas de liquidación</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {auctions.map((a) => (
              <Link
                key={a.id}
                to={`/productos/${a.product_id}`}
                className="block bg-white rounded-xl border border-slate-200 p-3 hover:shadow transition"
              >
                <p className="font-bold text-brand-950 text-sm truncate">{a.products?.title ?? 'Producto'}</p>
                <p className="mt-1 text-sm">
                  <span className="font-extrabold">{clp(a.current_bid ?? a.starting_price)}</span>{' '}
                  <span className="text-slate-500">· cierra {new Date(a.ends_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {user && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {saved.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white pl-3 pr-1 py-1 text-sm">
              <button onClick={() => setF({ ...emptyFilters, ...s.filters })} className="font-semibold text-brand-900 hover:underline">
                {s.name}
              </button>
              <button onClick={() => void removeFilter(s.id)} aria-label={`Borrar filtro ${s.name}`} className="rounded-full px-2 text-slate-400 hover:text-red-700">
                ×
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              className="field-input w-40! py-1.5!"
              maxLength={40}
              placeholder="Guardar filtros como…"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              aria-label="Nombre del filtro"
            />
            <button
              onClick={() => {
                const n = filterName.trim();
                if (n.length < 2) return;
                void saveFilter(n, f).then(() => setFilterName(''));
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
            >
              Guardar
            </button>
          </span>
        </div>
      )}
      {loading && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="Sin resultados"
          text="Ajusta los filtros o vuelve cuando se publiquen nuevos productos."
        />
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </Layout>
  );
}
