import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { PageHeader } from '../../components/ui';
import { cop } from '../../lib/format';
import { fetchBestSellers, fetchCompanyRecovery, fetchCounts } from '../../data/admin';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="font-bold text-brand-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Dashboard />
      </AdminLayout>
    </RequireAdmin>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState<any>(null);
  const [best, setBest] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCounts(), fetchBestSellers(), fetchCompanyRecovery()])
      .then(([c, b, r]) => {
        setCounts(c);
        setBest(b);
        setRecovery(r.slice(0, 5));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <>
      <PageHeader title="Tablero" subtitle="Operación de la plataforma." />
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error} — Revisa la conexión Supabase y las migraciones.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Lotes publicados', counts?.lots?.published ?? '—', '/admin/lotes'],
          ['Pedidos pendientes', (counts?.orders?.pending_payment ?? 0) + (counts?.orders?.paid ?? 0), '/admin/pedidos'],
          ['Paquetes por procesar', (counts?.packages?.received ?? 0) + (counts?.packages?.inspecting ?? 0) + (counts?.packages?.classified ?? 0), '/admin/paquetes'],
          ['Tickets abiertos', counts?.openTickets ?? '—', '/ayuda'],
        ].map(([label, value, to]) => (
          <Link key={label as string} to={to as string} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow transition">
            <p className="text-3xl font-extrabold text-brand-950">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Más vendidos">
          {best.length === 0 && <p className="text-sm text-slate-500">Sin ventas aún.</p>}
          <ul className="space-y-2 text-sm">
            {best.map((b) => (
              <li key={b.id} className="flex justify-between gap-2">
                <span className="font-mono text-slate-500">{b.sku}</span>
                <span className="flex-1 truncate">{b.title}</span>
                <span className="font-bold whitespace-nowrap">{cop(Number(b.revenue))}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Valor recuperado por empresa">
          {recovery.length === 0 && <p className="text-sm text-slate-500">Sin empresas con actividad.</p>}
          <ul className="space-y-2 text-sm">
            {recovery.map((r) => (
              <li key={r.company_id} className="flex justify-between gap-2">
                <span className="flex-1 truncate font-semibold">{r.company_name}</span>
                <span className="whitespace-nowrap">{r.lots_sold} lotes · {cop(Number(r.revenue_recovered))}</span>
              </li>
            ))}
          </ul>
          <Link to="/admin/empresas" className="mt-3 inline-block text-sm text-brand-900 font-semibold underline">
            Ver empresas
          </Link>
        </Card>
      </div>
    </>
  );
}
