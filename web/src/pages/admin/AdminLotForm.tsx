import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { PageHeader } from '../../components/ui';
import {
  deleteLotImage,
  deleteTier,
  fetchLotAdmin,
  fetchTable,
  saveLot,
  saveTier,
  uploadLotImage,
} from '../../data/admin';
import { publicImageUrl } from '../../data/shop';
import {
  checkRequired,
  parsePrice,
  sanitizeText,
} from '../../lib/validation';

const PACKAGING = ['original', 'damaged', 'no_box'];
const PRODUCT = ['intact', 'functional', 'for_parts'];
const STATUS = ['draft', 'published', 'paused', 'sold_out', 'archived'];

const num = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function AdminLotForm() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Form />
      </AdminLayout>
    </RequireAdmin>
  );
}

function Form() {
  const { id } = useParams();
  const isNew = !id || id === 'nuevo';
  const navigate = useNavigate();

  const [companies, setCompanies] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);

  const [f, setF] = useState({
    title: '', description: '', company_id: '', package_id: '',
    warehouse_id: '', warehouse_zone: '', brand_id: '',
    packaging_state: 'original', product_state: 'intact', is_verified: false,
    unit_count: '1', total_weight_kg: '0', length_cm: '', width_cm: '', height_cm: '',
    base_price: '', msrp_reference: '', currency: 'COP', stock_quantity: '1',
    status: 'draft', is_featured: false, circularity_percent: '', waste_avoided_kg: '',
  });
  const [catIds, setCatIds] = useState<string[]>([]);
  const [tierQty, setTierQty] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchTable('companies'), fetchTable('warehouses'),
      fetchTable('brands'), fetchTable('categories', 'sort_order'),
      fetchTable('packages', 'received_at'),
    ]).then(([c, w, b, cat, p]) => {
      setCompanies(c); setWarehouses(w); setBrands(b); setCategories(cat); setPackages(p);
    }).catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
    if (!isNew && id) {
      fetchLotAdmin(id).then((lot) => {
        setF({
          title: lot.title ?? '', description: lot.description ?? '',
          company_id: lot.company_id ?? '', package_id: lot.package_id ?? '',
          warehouse_id: lot.warehouse_id ?? '', warehouse_zone: lot.warehouse_zone ?? '',
          brand_id: lot.brand_id ?? '', packaging_state: lot.packaging_state,
          product_state: lot.product_state, is_verified: lot.is_verified,
          unit_count: String(lot.unit_count), total_weight_kg: String(lot.total_weight_kg),
          length_cm: lot.length_cm ?? '', width_cm: lot.width_cm ?? '', height_cm: lot.height_cm ?? '',
          base_price: String(lot.base_price), msrp_reference: lot.msrp_reference ?? '',
          currency: lot.currency, stock_quantity: String(lot.stock_quantity),
          status: lot.status, is_featured: lot.is_featured,
          circularity_percent: lot.circularity_percent ?? '', waste_avoided_kg: lot.waste_avoided_kg ?? '',
        });
        setCatIds((lot.lot_categories ?? []).map((c: any) => c.category_id));
        setImages(lot.lot_images ?? []);
        setTiers(lot.lot_price_tiers ?? []);
      }).catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
    }
  }, [id, isNew]);

  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }) as typeof f);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const title = sanitizeText(f.title, 200);
    const errTitle = checkRequired(title, 'Título', 3, 200);
    const base = parsePrice(f.base_price);
    if (errTitle) { setMsg(errTitle); return; }
    if (base == null) { setMsg('Precio base inválido.'); return; }
    const units = Math.max(1, Math.floor(num(f.unit_count, 1)));
    setBusy(true);
    try {
      const savedId = await saveLot(isNew ? null : (id as string), {
        title,
        description: sanitizeText(f.description, 5000) || '',
        company_id: f.company_id || null,
        package_id: f.package_id || null,
        warehouse_id: f.warehouse_id || null,
        warehouse_zone: sanitizeText(f.warehouse_zone, 100),
        brand_id: f.brand_id || null,
        packaging_state: f.packaging_state,
        product_state: f.product_state,
        is_verified: f.is_verified,
        unit_count: units,
        total_weight_kg: Math.max(0, num(f.total_weight_kg)),
        length_cm: f.length_cm === '' ? null : Math.max(0, num(f.length_cm)),
        width_cm: f.width_cm === '' ? null : Math.max(0, num(f.width_cm)),
        height_cm: f.height_cm === '' ? null : Math.max(0, num(f.height_cm)),
        base_price: base,
        msrp_reference: f.msrp_reference === '' ? null : parsePrice(f.msrp_reference),
        currency: f.currency === 'USD' ? 'USD' : 'COP',
        stock_quantity: Math.max(0, Math.floor(num(f.stock_quantity, 1))),
        status: f.status,
        is_featured: f.is_featured,
        circularity_percent: f.circularity_percent === '' ? null : Math.min(100, Math.max(0, num(f.circularity_percent))),
        waste_avoided_kg: f.waste_avoided_kg === '' ? null : Math.max(0, num(f.waste_avoided_kg)),
        category_ids: catIds,
      });
      navigate(`/admin/lotes/${savedId}`, { replace: true });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id || isNew) return;
    setMsg(null);
    try {
      await uploadLotImage(id, file, images.length === 0);
      const lot = await fetchLotAdmin(id);
      setImages(lot.lot_images ?? []);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
    e.target.value = '';
  }

  async function onAddTier() {
    if (!id || isNew) return;
    const q = Math.max(2, Math.floor(num(tierQty)));
    const p = parsePrice(tierPrice);
    if (!q || p == null) { setMsg('Tramo inválido: cantidad ≥ 2 y precio ≥ 0.'); return; }
    try {
      await saveTier(id, q, p);
      const lot = await fetchLotAdmin(id);
      setTiers(lot.lot_price_tiers ?? []);
      setTierQty(''); setTierPrice('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const input = 'field-input';
  return (
    <>
      <PageHeader title={isNew ? 'Nuevo lote' : 'Editar lote'} subtitle="Carga de productos (Gestión Circular)." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      <form id="lot-form" onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold text-brand-950">Información general</h2>
          <div>
            <label className="field-label" htmlFor="lt-title">Nombre del lote</label>
            <input id="lt-title" className={input} maxLength={200} value={f.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="lt-desc">Descripción</label>
            <textarea id="lt-desc" className={input} rows={4} maxLength={5000} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <span className="field-label">Categorías</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.id} className={`text-xs font-semibold rounded-full px-3 py-1.5 border cursor-pointer ${catIds.includes(c.id) ? 'bg-brand-900 text-white border-brand-900' : 'border-slate-300'}`}>
                  <input
                    type="checkbox" className="sr-only"
                    checked={catIds.includes(c.id)}
                    onChange={() => setCatIds((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-company">Empresa origen</label>
              <select id="lt-company" className={input} value={f.company_id} onChange={(e) => set('company_id', e.target.value)}>
                <option value="">—</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="lt-brand">Marca</label>
              <select id="lt-brand" className={input} value={f.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
                <option value="">—</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[#1a365d]" checked={f.is_verified} onChange={(e) => set('is_verified', e.target.checked)} />
            Empresa/lote verificado
          </label>
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold text-brand-950">Estado y logística</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-pack">Empaque</label>
              <select id="lt-pack" className={input} value={f.packaging_state} onChange={(e) => set('packaging_state', e.target.value)}>
                {PACKAGING.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="lt-prod">Producto</label>
              <select id="lt-prod" className={input} value={f.product_state} onChange={(e) => set('product_state', e.target.value)}>
                {PRODUCT.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-units">Unidades</label>
              <input id="lt-units" type="number" min={1} className={input} value={f.unit_count} onChange={(e) => set('unit_count', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="lt-weight">Peso total (kg)</label>
              <input id="lt-weight" type="number" min={0} step="0.01" className={input} value={f.total_weight_kg} onChange={(e) => set('total_weight_kg', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(['length_cm', 'width_cm', 'height_cm'] as const).map((k, i) => (
              <div key={k}>
                <label className="field-label" htmlFor={`lt-${k}`}>{['Largo', 'Ancho', 'Alto'][i]} (cm)</label>
                <input id={`lt-${k}`} type="number" min={0} step="0.1" className={input} value={f[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-wh">Bodega</label>
              <select id="lt-wh" className={input} value={f.warehouse_id} onChange={(e) => set('warehouse_id', e.target.value)}>
                <option value="">—</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.city}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="lt-zone">Zona (pasillo/muelle)</label>
              <input id="lt-zone" className={input} maxLength={100} value={f.warehouse_zone} onChange={(e) => set('warehouse_zone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="lt-pkg">Paquete origen</label>
            <select id="lt-pkg" className={input} value={f.package_id} onChange={(e) => set('package_id', e.target.value)}>
              <option value="">—</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.origin ?? p.id.slice(0, 8)} · {p.total_units} uds</option>)}
            </select>
          </div>
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold text-brand-950">Comercial</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-price">Precio base</label>
              <input id="lt-price" type="number" min={0} step="0.01" className={input} value={f.base_price} onChange={(e) => set('base_price', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="lt-msrp">MSRP ref.</label>
              <input id="lt-msrp" type="number" min={0} step="0.01" className={input} value={f.msrp_reference} onChange={(e) => set('msrp_reference', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="lt-cur">Moneda</label>
              <select id="lt-cur" className={input} value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                <option>COP</option>
                <option>USD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-stock">Stock (lotes)</label>
              <input id="lt-stock" type="number" min={0} className={input} value={f.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="lt-status">Estado</label>
              <select id="lt-status" className={input} value={f.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="lt-circ">Circularidad %</label>
              <input id="lt-circ" type="number" min={0} max={100} className={input} value={f.circularity_percent} onChange={(e) => set('circularity_percent', e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="lt-waste">Desecho evitado (kg)</label>
              <input id="lt-waste" type="number" min={0} step="0.01" className={input} value={f.waste_avoided_kg} onChange={(e) => set('waste_avoided_kg', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[#1a365d]" checked={f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
            Destacado en portada
          </label>
        </section>

        <section className="bg-white rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold text-brand-950">Precios por volumen</h2>
          {isNew && <p className="text-sm text-slate-500">Guarda el lote para agregar tramos.</p>}
          {!isNew && (
            <>
              <ul className="space-y-1 text-sm">
                {tiers.map((t) => (
                  <li key={t.id} className="flex justify-between border-b border-slate-100 py-1">
                    <span>Desde {t.min_quantity} uds → {t.unit_price}</span>
                    <button type="button" className="text-red-700 underline" onClick={() => { void deleteTier(t.id).then(() => fetchLotAdmin(id as string).then((l) => setTiers(l.lot_price_tiers ?? []))); }}>
                      Quitar
                    </button>
                  </li>
                ))}
                {tiers.length === 0 && <li className="text-slate-500">Sin tramos.</li>}
              </ul>
              <div className="flex gap-2">
                <input className={input} type="number" min={2} placeholder="Cant. mín." value={tierQty} onChange={(e) => setTierQty(e.target.value)} aria-label="Cantidad mínima" />
                <input className={input} type="number" min={0} placeholder="Precio" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} aria-label="Precio por volumen" />
                <button type="button" onClick={() => void onAddTier()} className="rounded-lg border px-4 font-semibold shrink-0">Agregar</button>
              </div>
            </>
          )}
          <h2 className="font-bold text-brand-950 pt-2">Evidencia fotográfica</h2>
          {isNew && <p className="text-sm text-slate-500">Guarda el lote para subir fotos.</p>}
          {!isNew && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {images.map((im) => (
                  <div key={im.id} className="relative">
                    <img src={publicImageUrl(im.storage_path)} alt="" className="aspect-square object-cover rounded-lg border" />
                    {im.is_primary && <span className="absolute top-1 left-1 text-[10px] font-bold bg-brand-900 text-white rounded px-1.5 py-0.5">PRINCIPAL</span>}
                    <button type="button" className="absolute top-1 right-1 text-[10px] font-bold bg-white border rounded px-1.5 py-0.5" onClick={() => { void deleteLotImage(im.id, im.storage_path).then(() => fetchLotAdmin(id as string).then((l) => setImages(l.lot_images ?? []))); }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <label className="block text-sm font-semibold text-brand-900 cursor-pointer">
                + Subir foto (JPG/PNG/WebP, máx. 5 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhoto} />
              </label>
            </>
          )}
        </section>
      </form>
      <div className="mt-4 flex gap-3">
        <button onClick={() => void (document.getElementById('lot-form') as HTMLFormElement | null)?.requestSubmit()} disabled={busy} className="rounded-lg bg-brand-900 text-white font-semibold px-6 py-3 hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Guardando…' : isNew ? 'Crear lote' : 'Guardar cambios'}
        </button>
        <Link to="/admin/lotes" className="rounded-lg border px-6 py-3 font-semibold">Volver</Link>
      </div>
    </>
  );
}
