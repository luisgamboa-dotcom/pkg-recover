import { useState } from 'react';
import Layout from '../components/Layout';
import { ConfigNotice, EmptyState, LotCard, PageHeader } from '../components/ui';
import { emptyFilters, useBrands, useCatalog, useCategories, type Filters } from '../data/shop';
import { LIMITS } from '../lib/validation';

export default function Catalog() {
  const [f, setF] = useState<Filters>(emptyFilters);
  const { lots, total, loading, error, configured } = useCatalog(f);
  const categories = useCategories();
  const brands = useBrands();

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  return (
    <Layout>
      <PageHeader
        title="Catálogo de lotes"
        subtitle={`${total} lotes publicados · precios en COP con IVA calculado en caja`}
      />
      {!configured && (
        <div className="mb-4">
          <ConfigNotice />
        </div>
      )}

      {/* Búsqueda y filtros (prompt §4) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 grid gap-3 md:grid-cols-4">
        <input
          className="field-input md:col-span-2"
          maxLength={LIMITS.search}
          placeholder="Buscar por nombre o SKU…"
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
          aria-label="Buscar lotes"
        />
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

      {loading && <p className="text-sm text-slate-500">Cargando lotes…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {!loading && !error && lots.length === 0 && (
        <EmptyState
          title="Sin resultados"
          text="Ajusta los filtros o vuelve cuando se publiquen nuevos lotes."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>
    </Layout>
  );
}
