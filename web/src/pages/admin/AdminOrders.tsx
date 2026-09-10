import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { cop, formatDate, orderStatusLabel } from '../../lib/format';
import { fetchAllOrders } from '../../data/admin';

export default function AdminOrders() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <List />
      </AdminLayout>
    </RequireAdmin>
  );
}

function List() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAllOrders()
      .then(setOrders)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
  }, []);

  const shown = status ? orders.filter((o) => o.status === status) : orders;

  return (
    <>
      <PageHeader title="Pedidos" subtitle="Todos los pedidos, compradores y estados." />
      {msg && <p className="mb-3 text-sm text-red-700 bg-red-50 border rounded-lg p-3">{msg}</p>}
      <div className="mb-4">
        <select className="field-input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
            <option key={s} value={s}>{orderStatusLabel(s)}</option>
          ))}
        </select>
      </div>
      {shown.length === 0 && <EmptyState title="Sin pedidos" text="Aún no hay ventas registradas." />}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="p-3">Pedido</th><th className="p-3">Fecha</th><th className="p-3">Comprador</th>
              <th className="p-3">Ciudad</th><th className="p-3">Estado</th><th className="p-3">Total</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="p-3 font-mono font-bold">{o.order_number}</td>
                <td className="p-3 whitespace-nowrap">{formatDate(o.created_at)}</td>
                <td className="p-3">{o.profiles ? `${o.profiles.first_name ?? ''} ${o.profiles.last_name ?? ''}`.trim() || '—' : '—'}</td>
                <td className="p-3">{o.ship_city}</td>
                <td className="p-3">{orderStatusLabel(o.status)}</td>
                <td className="p-3 font-bold">{cop(Number(o.total))}</td>
                <td className="p-3"><Link to={`/admin/pedidos/${o.id}`} className="text-brand-900 underline">Gestionar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
