import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../data/account';
import { formatDate } from '../lib/format';

const TYPE_LABEL: Record<string, string> = {
  offer: 'Oferta',
  new_lot: 'Nuevo lote',
  order_update: 'Pedido',
  shipping_update: 'Despacho',
  availability: 'Disponibilidad',
  system: 'Sistema',
};

export default function Notifications() {
  return (
    <ProtectedRoute>
      <List />
    </ProtectedRoute>
  );
}

function List() {
  const { user } = useAuth();
  const { items, loading, markRead, markAllRead, unread } = useNotifications(user?.id);

  const target = (n: { lot_id: string | null; order_id: string | null }) =>
    n.order_id ? `/pedidos/${n.order_id}` : n.lot_id ? `/lotes/${n.lot_id}` : null;

  return (
    <Layout>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Avisos" subtitle={`${unread} sin leer · ofertas, pedidos y despachos.`} />
        {unread > 0 && (
          <button onClick={() => void markAllRead()} className="rounded-lg border px-4 py-2 text-sm font-semibold">
            Marcar todo leído
          </button>
        )}
      </div>
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && items.length === 0 && (
        <EmptyState title="Sin avisos" text="Aquí verás ofertas, nuevos lotes y cambios en tus pedidos." />
      )}
      <div className="space-y-2">
        {items.map((n) => {
          const to = target(n);
          const body = (
            <div className={`bg-white rounded-2xl border p-4 ${n.is_read ? '' : 'border-brand-900 shadow'}`}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-2.5 py-0.5">
                  {TYPE_LABEL[n.type] ?? n.type}
                </span>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-accent-500" aria-label="Sin leer" />}
                <span className="ml-auto text-xs text-slate-400">{formatDate(n.created_at)}</span>
              </div>
              <p className="mt-1.5 font-bold text-brand-950">{n.title}</p>
              {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
            </div>
          );
          return to ? (
            <Link key={n.id} to={to} onClick={() => void markRead(n.id)}>
              {body}
            </Link>
          ) : (
            <button key={n.id} onClick={() => void markRead(n.id)} className="block w-full text-left">
              {body}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Ajusta qué avisos recibes en <Link to="/cuenta" className="underline font-semibold">Mi cuenta → Notificaciones</Link>.
      </p>
    </Layout>
  );
}
