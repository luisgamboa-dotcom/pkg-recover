import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useMyOrders } from '../data/account';
import { cop, formatDate, orderStatusLabel } from '../lib/format';

export default function Orders() {
  return (
    <ProtectedRoute>
      <OrdersList />
    </ProtectedRoute>
  );
}

function OrdersList() {
  const { user } = useAuth();
  const { orders, loading, configured } = useMyOrders(user?.id);

  return (
    <Layout>
      <PageHeader title="Mis pedidos" subtitle="Historial, estados y seguimiento." />
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4">
          Sin conexión a Supabase: configura <code>web/.env</code> y aplica las
          migraciones.
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">Cargando pedidos…</p>}
      {!loading && orders.length === 0 && (
        <EmptyState
          title="Aún no tienes pedidos"
          text="Cuando compres un lote, aparecerá aquí con su seguimiento."
        />
      )}
      <div className="space-y-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/pedidos/${o.id}`}
            className="block bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-[0_10px_30px_rgba(26,54,93,0.12)] transition"
          >
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <p className="font-mono font-bold text-brand-950">{o.order_number}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(o.created_at)} · {o.items.length} lote(s) ·{' '}
                  {o.payment_method?.name ?? '—'}
                </p>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-3 py-1">
                {orderStatusLabel(o.status)}
              </span>
              <p className="font-extrabold text-brand-950">{cop(o.total)}</p>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
