import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { PageHeader } from '../../components/ui';
import { cop, orderStatusLabel } from '../../lib/format';
import { fetchBestSellers, fetchCompanyRecovery, fetchCounts, fetchInventorySummary } from '../../data/admin';

const PIE_COLORS = ['#1a365d', '#ed8936', '#2f855a', '#718096', '#9f7aea', '#e53e3e'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border p-5">
      <h2 className="font-bold text-brand-950">{title}</h2>
      <div className="mt-2 h-64">{children}</div>
    </section>
  );
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <View />
      </AdminLayout>
    </RequireAdmin>
  );
}

function View() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [best, setBest] = useState<any[]>([]);
  const [orderStates, setOrderStates] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchInventorySummary(), fetchCompanyRecovery(), fetchBestSellers(), fetchCounts()])
      .then(([i, r, b, c]) => {
        setInventory(i);
        setRecovery(r);
        setBest(b);
        setOrderStates(c.orders ?? {});
      })
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
  }, []);

  const totalStockValue = inventory.reduce((a, r) => a + Number(r.stock_value ?? 0), 0);
  const totalRecovered = recovery.reduce((a, r) => a + Number(r.revenue_recovered ?? 0), 0);

  const recoveryChart = recovery.map((r) => ({
    name: String(r.company_name).slice(0, 18),
    recuperado: Number(r.revenue_recovered ?? 0),
  }));
  const byStatus = new Map<string, number>();
  for (const r of inventory) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + Number(r.stock_value ?? 0));
  }
  const statusChart = [...byStatus.entries()].map(([name, value]) => ({ name, value }));
  const ordersChart = Object.entries(orderStates).map(([status, count]) => ({
    name: orderStatusLabel(status),
    pedidos: count,
  }));
  const bestChart = best.slice(0, 6).map((b) => ({
    name: String(b.sku ?? b.title).slice(0, 12),
    ingresos: Number(b.revenue ?? 0),
  }));

  return (
    <>
      <PageHeader title="Reportes" subtitle="Estadísticas y descarga de datos." />
      {msg && <p className="mb-3 text-sm text-red-700 bg-red-50 border rounded-lg p-3">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <ChartCard title="Valor recuperado por empresa (COP)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recoveryChart} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} fontSize={11} height={50} />
              <YAxis fontSize={11} tickFormatter={(v: any) => `${Math.round(Number(v) / 1000000)}M`} />
              <Tooltip formatter={(v: any) => cop(Number(v ?? 0))} />
              <Bar dataKey="recuperado" fill="#2f855a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Inventario valorizado por estado">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusChart} dataKey="value" nameKey="name" outerRadius={85} label={{ fontSize: 11 }}>
                {statusChart.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => cop(Number(v ?? 0))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Pedidos por estado">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ordersChart} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis type="category" dataKey="name" width={120} fontSize={11} />
              <Tooltip />
              <Bar dataKey="pedidos" fill="#1a365d" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top lotes por ingresos (COP)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bestChart} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} fontSize={11} height={50} />
              <YAxis fontSize={11} tickFormatter={(v: any) => `${Math.round(Number(v) / 1000000)}M`} />
              <Tooltip formatter={(v: any) => cop(Number(v ?? 0))} />
              <Bar dataKey="ingresos" fill="#ed8936" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-bold text-brand-950">Valor económico recuperado: {cop(totalRecovered)}</h2>
          <ul className="mt-3 space-y-1.5 text-sm max-h-72 overflow-auto">
            {recovery.map((r) => (
              <li key={r.company_id} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                <span>{r.company_name} <span className="text-slate-400">({r.packages_received} paq. · {r.lots_sold} vendidos)</span></span>
                <span className="font-bold whitespace-nowrap">{cop(Number(r.revenue_recovered))}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => downloadCsv('recuperacion_empresas.csv', [
              ['empresa', 'verificada', 'paquetes', 'publicados', 'vendidos', 'recuperado'],
              ...recovery.map((r) => [r.company_name, r.is_verified ? 'si' : 'no', r.packages_received, r.lots_published, r.lots_sold, r.revenue_recovered]),
            ])}
            className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            ⬇ Descargar CSV
          </button>
        </section>

        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-bold text-brand-950">Inventario valorizado: {cop(totalStockValue)}</h2>
          <ul className="mt-3 space-y-1.5 text-sm max-h-72 overflow-auto">
            {inventory.slice(0, 30).map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                <span className="font-mono text-slate-500">{r.sku}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="font-bold whitespace-nowrap">{cop(Number(r.stock_value))}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => downloadCsv('inventario.csv', [
              ['sku', 'titulo', 'estado', 'stock', 'precio', 'valor', 'bodega'],
              ...inventory.map((r) => [r.sku, r.title, r.status, r.stock_quantity, r.base_price, r.stock_value, r.warehouse_code ?? '']),
            ])}
            className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            ⬇ Descargar CSV
          </button>
        </section>
      </div>

      <section className="mt-4 bg-white rounded-2xl border p-5">
        <h2 className="font-bold text-brand-950">Productos más vendidos</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {best.map((b, i) => (
            <li key={b.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span>#{i + 1} {b.title} <span className="text-slate-400">({b.units_sold} uds · {b.orders_count} pedidos)</span></span>
              <span className="font-bold whitespace-nowrap">{cop(Number(b.revenue))}</span>
            </li>
          ))}
          {best.length === 0 && <li className="text-slate-500">Sin ventas aún.</li>}
        </ul>
      </section>
    </>
  );
}
