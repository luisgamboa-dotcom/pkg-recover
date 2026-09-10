import { useEffect, useState, type FormEvent } from 'react';
import Layout from '../components/Layout';
import { RequireCompany } from '../components/RequireRole';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import {
  fetchCompanyLots,
  fetchCompanyPackages,
  fetchCompanySales,
  fetchMyCompanies,
  registerCompanyPackage,
} from '../data/company';
import { cop, formatDate, orderStatusLabel } from '../lib/format';
import { sanitizeText } from '../lib/validation';

export default function CompanyPanel() {
  return (
    <RequireCompany>
      <Layout>
        <Panel />
      </Layout>
    </RequireCompany>
  );
}

function Panel() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeId, setActiveId] = useState('');
  const [packages, setPackages] = useState<any[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [origin, setOrigin] = useState('');
  const [units, setUnits] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchMyCompanies(user.id)
      .then((c) => {
        setCompanies(c);
        if (c.length > 0) setActiveId(c[0].id);
      })
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
  }, [user]);

  useEffect(() => {
    if (!activeId) return;
    Promise.all([
      fetchCompanyPackages(activeId),
      fetchCompanyLots(activeId),
      fetchCompanySales(activeId),
    ])
      .then(([p, l, s]) => {
        setPackages(p);
        setLots(l);
        setSales(s);
      })
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
  }, [activeId]);

  const active = companies.find((c) => c.id === activeId);
  const revenue = sales
    .filter((s) => !['cancelled', 'returned'].includes(s.orders?.status))
    .reduce((a, s) => a + Number(s.line_total), 0);

  async function onPackage(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeId) return;
    const u = Math.floor(Number(units));
    const w = Number(weight);
    if (!Number.isFinite(u) || u < 0) { setMsg('Unidades inválidas.'); return; }
    if (!Number.isFinite(w) || w < 0) { setMsg('Peso inválido.'); return; }
    try {
      await registerCompanyPackage(user.id, activeId, {
        origin: sanitizeText(origin, 200) || null,
        total_units: u,
        total_weight_kg: w,
        status: 'received',
      });
      setOrigin(''); setUnits(''); setWeight('');
      setPackages(await fetchCompanyPackages(activeId));
      setMsg('Paquete registrado como entregado.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Mi empresa" subtitle="Paquetes entregados, productos y valor recuperado." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      {companies.length === 0 && (
        <EmptyState title="Sin empresa asociada" text="Un administrador debe vincular tu cuenta a una empresa proveedora." />
      )}
      {companies.length > 1 && (
        <select className="field-input !w-auto mb-4" value={activeId} onChange={(e) => setActiveId(e.target.value)} aria-label="Empresa">
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {active && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Paquetes entregados', active.stats?.packages_received ?? packages.length],
              ['Lotes publicados', active.stats?.lots_published ?? '—'],
              ['Lotes vendidos', active.stats?.lots_sold ?? '—'],
              ['Recuperado', cop(revenue)],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-white rounded-2xl border p-5">
                <p className="text-2xl font-extrabold text-brand-950">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {active.name} · {active.verification_code ?? 'sin código'} ·{' '}
            {active.is_verified ? '✅ verificada' : '⏳ pendiente de verificación'}
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="bg-white rounded-2xl border p-5">
              <h2 className="font-bold text-brand-950">Registrar entrega de paquetes</h2>
              <form onSubmit={onPackage} className="mt-3 grid grid-cols-3 gap-2">
                <input className="field-input col-span-3" maxLength={200} placeholder="Origen (transportadora, ciudad…)" value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Origen" />
                <input className="field-input" type="number" min={0} placeholder="Unidades" value={units} onChange={(e) => setUnits(e.target.value)} aria-label="Unidades" />
                <input className="field-input" type="number" min={0} step="0.01" placeholder="Peso kg" value={weight} onChange={(e) => setWeight(e.target.value)} aria-label="Peso" />
                <button className="rounded-lg bg-brand-900 text-white font-semibold hover:bg-brand-700">Registrar</button>
              </form>
              <h2 className="mt-5 font-bold text-brand-950">Historial de entregas</h2>
              <ul className="mt-2 space-y-1.5 text-sm max-h-64 overflow-auto">
                {packages.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span>{formatDate(p.received_at)} · {p.origin ?? '—'}</span>
                    <span className="whitespace-nowrap">{p.total_units} uds · {p.status}</span>
                  </li>
                ))}
                {packages.length === 0 && <li className="text-slate-500">Sin entregas.</li>}
              </ul>
            </section>

            <section className="bg-white rounded-2xl border p-5">
              <h2 className="font-bold text-brand-950">Lotes derivados</h2>
              <ul className="mt-2 space-y-1.5 text-sm max-h-64 overflow-auto">
                {lots.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span className="font-mono text-slate-500">{l.sku}</span>
                    <span className="flex-1 truncate">{l.title}</span>
                    <span className="whitespace-nowrap">{l.status} · {cop(Number(l.base_price))}</span>
                  </li>
                ))}
                {lots.length === 0 && <li className="text-slate-500">Aún no hay lotes de tus paquetes.</li>}
              </ul>
              <h2 className="mt-5 font-bold text-brand-950">Ventas de tus lotes</h2>
              <ul className="mt-2 space-y-1.5 text-sm max-h-64 overflow-auto">
                {sales.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span>{s.orders?.order_number} · {s.lots?.title} × {s.quantity}</span>
                    <span className="whitespace-nowrap">{orderStatusLabel(s.orders?.status ?? '')} · {cop(Number(s.line_total))}</span>
                  </li>
                ))}
                {sales.length === 0 && <li className="text-slate-500">Sin ventas aún.</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
