import { useEffect, useState, type FormEvent } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { fetchPackages, fetchTable, savePackage } from '../../data/admin';
import { formatDate } from '../../lib/format';
import { checkMax, sanitizeText } from '../../lib/validation';

const STATUS = ['received', 'inspecting', 'classified', 'processed', 'cancelled'];

export default function AdminPackages() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <View />
      </AdminLayout>
    </RequireAdmin>
  );
}

function View() {
  const [items, setItems] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [origin, setOrigin] = useState('');
  const [units, setUnits] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchPackages()
      .then(setItems)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));

  useEffect(() => {
    void load();
    fetchTable('companies').then(setCompanies).catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const u = Math.floor(Number(units));
    const w = Number(weight);
    if (!Number.isFinite(u) || u < 0 || u > 1000000) { setMsg('Unidades inválidas.'); return; }
    if (!Number.isFinite(w) || w < 0 || w > 1000000) { setMsg('Peso inválido.'); return; }
    const cleanOrigin = sanitizeText(origin, 200);
    const cleanNotes = sanitizeText(notes, 2000);
    const errLen = checkMax(cleanOrigin, 'Origen', 200) ?? checkMax(cleanNotes, 'Notas', 2000);
    if (errLen) { setMsg(errLen); return; }
    try {
      await savePackage(null, {
        company_id: companyId || null,
        origin: cleanOrigin || null,
        total_units: u,
        total_weight_kg: w,
        status: 'received',
        notes: cleanNotes || null,
      });
      setCompanyId(''); setOrigin(''); setUnits(''); setWeight(''); setNotes('');
      await load();
      setMsg('Paquete registrado como recibido.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await savePackage(id, { status });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Paquetes" subtitle="Recepción, clasificación y procesamiento." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      <form onSubmit={onSubmit} className="bg-white rounded-2xl border p-4 grid gap-3 md:grid-cols-5 mb-6">
        <select className="field-input" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Empresa origen">
          <option value="">Empresa…</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="field-input" maxLength={200} placeholder="Origen" value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Origen" />
        <input className="field-input" type="number" min={0} placeholder="Unidades" value={units} onChange={(e) => setUnits(e.target.value)} aria-label="Unidades" />
        <input className="field-input" type="number" min={0} step="0.01" placeholder="Peso kg" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Peso" />
        <input className="field-input" maxLength={2000} placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notas" />
        <button className="rounded-lg bg-brand-900 text-white font-semibold px-4 hover:bg-brand-700 md:col-start-5">Registrar</button>
      </form>
      {items.length === 0 && <EmptyState title="Sin paquetes" text="Registra la recepción de paquetes de empresas." />}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="p-3">Recepción</th><th className="p-3">Empresa</th><th className="p-3">Origen</th>
              <th className="p-3">Uds</th><th className="p-3">Kg</th><th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3 whitespace-nowrap">{formatDate(p.received_at)}</td>
                <td className="p-3">{p.companies?.name ?? '—'}</td>
                <td className="p-3">{p.origin ?? '—'}</td>
                <td className="p-3">{p.total_units}</td>
                <td className="p-3">{Number(p.total_weight_kg)}</td>
                <td className="p-3">
                  <select className="field-input !w-auto !py-1" value={p.status} onChange={(e) => void setStatus(p.id, e.target.value)} aria-label="Estado del paquete">
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
