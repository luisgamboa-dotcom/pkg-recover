import { useEffect, useState, type FormEvent } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { addMovement, fetchAllLots, fetchMovements } from '../../data/admin';
import { formatDate } from '../../lib/format';
import { checkMax, sanitizeText } from '../../lib/validation';

const TYPES = ['inbound', 'sale', 'adjustment', 'return', 'removal'];

export default function AdminInventory() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <View />
      </AdminLayout>
    </RequireAdmin>
  );
}

function View() {
  const [movs, setMovs] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [lotId, setLotId] = useState('');
  const [type, setType] = useState('inbound');
  const [qty, setQty] = useState('1');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchMovements()
      .then(setMovs)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));

  useEffect(() => {
    void load();
    fetchAllLots().then(setLots).catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const q = Math.floor(Number(qty));
    if (!lotId) { setMsg('Selecciona el lote.'); return; }
    if (!Number.isFinite(q) || q <= 0 || q > 100000) { setMsg('Cantidad inválida (1–100000).'); return; }
    const cleanRef = sanitizeText(ref, 100);
    const cleanNotes = sanitizeText(notes, 1000);
    const errRef = checkMax(cleanRef, 'Referencia', 100) ?? checkMax(cleanNotes, 'Notas', 1000);
    if (errRef) { setMsg(errRef); return; }
    try {
      await addMovement({ lot_id: lotId, movement_type: type, quantity: q, reference: cleanRef, notes: cleanNotes });
      setQty('1'); setRef(''); setNotes('');
      await load();
      setMsg('Movimiento registrado.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Inventario" subtitle="Movimientos y existencias por lote." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      <form onSubmit={onSubmit} className="bg-white rounded-2xl border p-4 grid gap-3 md:grid-cols-5 mb-6">
        <select className="field-input" value={lotId} onChange={(e) => setLotId(e.target.value)} aria-label="Lote">
          <option value="">Lote…</option>
          {lots.map((l) => <option key={l.id} value={l.id}>{l.sku} · {l.title} (stock {l.stock_quantity})</option>)}
        </select>
        <select className="field-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="field-input" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Cantidad" />
        <input className="field-input" maxLength={100} placeholder="Referencia (pedido…)" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Referencia" />
        <button className="rounded-lg bg-brand-900 text-white font-semibold px-4 hover:bg-brand-700">Registrar</button>
        <input className="field-input md:col-span-4" maxLength={1000} placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notas" />
      </form>
      {movs.length === 0 && <EmptyState title="Sin movimientos" text="Registra entradas, ajustes o retiros." />}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="p-3">Fecha</th><th className="p-3">Lote</th><th className="p-3">Tipo</th>
              <th className="p-3">Cant.</th><th className="p-3">Ref.</th><th className="p-3">Notas</th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="p-3 whitespace-nowrap">{formatDate(m.created_at)}</td>
                <td className="p-3">{m.lots?.sku} · {m.lots?.title}</td>
                <td className="p-3">{m.movement_type}</td>
                <td className="p-3 font-bold">{m.quantity}</td>
                <td className="p-3">{m.reference ?? '—'}</td>
                <td className="p-3 text-slate-500">{m.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Las ventas descuentan stock automáticamente vía trigger al crear el detalle del pedido.</p>
    </>
  );
}

