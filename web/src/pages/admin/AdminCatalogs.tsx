import { useEffect, useState, type FormEvent } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { PageHeader } from '../../components/ui';
import { deleteRow, fetchTable, linkPromotionLot, saveRow } from '../../data/admin';
import { sanitizeText } from '../../lib/validation';

/** Editor genérico: lista + formulario simple por tabla catálogo. */
function CatalogEditor({
  title,
  table,
  orderBy,
  fields,
  renderRow,
}: {
  title: string;
  table: string;
  orderBy?: string;
  fields: { key: string; label: string; type?: string; max: number }[];
  renderRow: (row: any) => string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchTable(table, orderBy)
      .then(setRows)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  function startEdit(row: any | null) {
    setEditing(row);
    const v: Record<string, string | boolean> = {};
    for (const f of fields) v[f.key] = row?.[f.key] ?? '';
    setValues(v);
    setMsg(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input: Record<string, any> = {};
    for (const f of fields) {
      const raw = values[f.key];
      const clean = sanitizeText(typeof raw === 'string' ? raw : '', f.max);
      if (f.type === 'number') {
        const n = Number(clean);
        if (!Number.isFinite(n)) { setMsg(`${f.label} inválido.`); return; }
        input[f.key] = clean === '' ? null : n;
      } else if (f.type === 'checkbox') {
        input[f.key] = raw === true || raw === 'true';
      } else {
        input[f.key] = clean === '' ? null : clean;
      }
    }
    if (fields.some((f) => f.key === 'name') && !input.name) {
      setMsg('El nombre es obligatorio.');
      return;
    }
    try {
      await saveRow(table, editing?.id ?? null, input);
      startEdit(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="bg-white rounded-2xl border p-4">
      <h2 className="font-bold text-brand-950">{title}</h2>
      {msg && <p className="my-2 text-xs text-slate-700 bg-slate-100 rounded p-2">{msg}</p>}
      <ul className="mt-2 space-y-1 text-sm max-h-56 overflow-auto">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-2 border-b border-slate-100 py-1">
            <span className="truncate">{renderRow(r)}</span>
            <span className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(r)} className="text-brand-900 underline">Editar</button>
              <button
                onClick={() => {
                  if (window.confirm('¿Eliminar?')) {
                    void deleteRow(table, r.id).then(load).catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
                  }
                }}
                className="text-red-700 underline"
              >
                Borrar
              </button>
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-slate-400">Vacío.</li>}
      </ul>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        {fields.map((f) => {
          const v = values[f.key];
          return f.type === 'checkbox' ? (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v === 'true' || v === true}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.checked }))}
              />
              {f.label}
            </label>
          ) : (
            <input
              key={f.key}
              className="field-input"
              type={f.type ?? 'text'}
              maxLength={f.max}
              placeholder={f.label}
              aria-label={f.label}
              value={typeof v === 'string' ? v : ''}
              onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          );
        })}
        <div className="flex gap-2">
          <button className="rounded-lg bg-brand-900 text-white px-4 py-2 text-sm font-semibold">
            {editing ? 'Guardar' : 'Agregar'}
          </button>
          {editing && (
            <button type="button" onClick={() => startEdit(null)} className="rounded-lg border px-4 py-2 text-sm">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default function AdminCatalogs() {
  const [promoId, setPromoId] = useState('');
  const [lotSku, setLotSku] = useState('');
  const [promos, setPromos] = useState<any[]>([]);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchTable('promotions', 'title').then(setPromos).catch(() => undefined);
  }, []);

  async function onLink(e: FormEvent) {
    e.preventDefault();
    setPromoMsg(null);
    const sku = sanitizeText(lotSku, 20).toUpperCase();
    if (!promoId || !sku) { setPromoMsg('Elige promoción y SKU.'); return; }
    try {
      const lots = await fetchTable('lots', 'sku');
      const lot = (lots as any[]).find((l) => String(l.sku).toUpperCase() === sku);
      if (!lot) { setPromoMsg(`No existe lote con SKU ${sku}.`); return; }
      await linkPromotionLot(promoId, lot.id);
      setLotSku('');
      setPromoMsg(`Lote ${sku} vinculado.`);
    } catch (err) {
      setPromoMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <RequireAdmin>
      <AdminLayout>
        <PageHeader title="Catálogos" subtitle="Categorías, marcas, promociones, FAQs, pagos y bodegas." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CatalogEditor
            title="Categorías"
            table="categories"
            orderBy="sort_order"
            fields={[
              { key: 'name', label: 'Nombre *', max: 100 },
              { key: 'slug', label: 'Slug', max: 100 },
              { key: 'description', label: 'Descripción', max: 1000 },
              { key: 'sort_order', label: 'Orden', type: 'number', max: 10 },
              { key: 'is_active', label: 'Activa', type: 'checkbox', max: 10 },
            ]}
            renderRow={(r) => `${r.name} (${r.slug})`}
          />
          <CatalogEditor
            title="Marcas"
            table="brands"
            fields={[
              { key: 'name', label: 'Nombre *', max: 100 },
              { key: 'slug', label: 'Slug', max: 100 },
            ]}
            renderRow={(r) => r.name}
          />
          <CatalogEditor
            title="Promociones"
            table="promotions"
            orderBy="title"
            fields={[
              { key: 'title', label: 'Título *', max: 200 },
              { key: 'description', label: 'Descripción', max: 2000 },
              { key: 'discount_percent', label: 'Descuento %', type: 'number', max: 10 },
              { key: 'is_active', label: 'Activa', type: 'checkbox', max: 10 },
            ]}
            renderRow={(r) => `${r.title} · ${r.discount_percent}%`}
          />
          <CatalogEditor
            title="Preguntas frecuentes"
            table="faqs"
            orderBy="sort_order"
            fields={[
              { key: 'category', label: 'Categoría', max: 60 },
              { key: 'question', label: 'Pregunta *', max: 500 },
              { key: 'answer', label: 'Respuesta', max: 5000 },
              { key: 'sort_order', label: 'Orden', type: 'number', max: 10 },
              { key: 'is_active', label: 'Activa', type: 'checkbox', max: 10 },
            ]}
            renderRow={(r) => r.question}
          />
          <CatalogEditor
            title="Métodos de pago"
            table="payment_methods"
            orderBy="sort_order"
            fields={[
              { key: 'code', label: 'Código *', max: 30 },
              { key: 'name', label: 'Nombre *', max: 100 },
              { key: 'description', label: 'Descripción', max: 1000 },
              { key: 'sort_order', label: 'Orden', type: 'number', max: 10 },
              { key: 'is_active', label: 'Activo', type: 'checkbox', max: 10 },
            ]}
            renderRow={(r) => `${r.name} (${r.code})`}
          />
          <CatalogEditor
            title="Bodegas"
            table="warehouses"
            orderBy="code"
            fields={[
              { key: 'code', label: 'Código *', max: 20 },
              { key: 'name', label: 'Nombre *', max: 150 },
              { key: 'city', label: 'Ciudad', max: 100 },
              { key: 'capacity_lots', label: 'Capacidad', type: 'number', max: 10 },
            ]}
            renderRow={(r) => `${r.code} · ${r.city}`}
          />
        </div>

        <section className="mt-4 bg-white rounded-2xl border p-4">
          <h2 className="font-bold text-brand-950">Vincular lote a promoción (por SKU)</h2>
          <form onSubmit={onLink} className="mt-2 flex flex-wrap gap-2">
            <select className="field-input !w-auto" value={promoId} onChange={(e) => setPromoId(e.target.value)} aria-label="Promoción">
              <option value="">Promoción…</option>
              {promos.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <input className="field-input !w-40" maxLength={20} placeholder="RP-00001" value={lotSku} onChange={(e) => setLotSku(e.target.value)} aria-label="SKU" />
            <button className="rounded-lg bg-brand-900 text-white px-4 font-semibold">Vincular</button>
          </form>
          {promoMsg && <p className="mt-2 text-sm text-slate-600">{promoMsg}</p>}
        </section>
      </AdminLayout>
    </RequireAdmin>
  );
}
