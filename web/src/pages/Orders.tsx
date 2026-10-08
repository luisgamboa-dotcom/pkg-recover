import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useMyOrders } from '../data/account';
import { convertOffer, useMyOffers } from '../data/buying';
import { clp, formatDate, orderStatusLabel } from '../lib/format';
import { errorMessage } from '../lib/validation';
import { useState } from 'react';

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
  const { items: offers, refresh: refreshOffers } = useMyOffers(user?.id);
  const navigate = useNavigate();
  const [offerMsg, setOfferMsg] = useState<string | null>(null);

  return (
    <Layout>
      <PageHeader title="Mis pedidos" subtitle="Historial, estados y seguimiento." />
      {offerMsg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-3">{offerMsg}</p>}
      {offers.length > 0 && (
        <section className="mb-6">
          <h2 className="font-bold text-brand-950">Mis ofertas</h2>
          <div className="mt-2 space-y-2">
            {offers.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <Link to={`/productos/${o.product_id}`} className="font-bold text-brand-950 hover:underline">
                    {o.products?.title ?? 'Producto'}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {formatDate(o.created_at)} · {o.quantity} ud. × {clp(o.amount)} ·{' '}
                    <span className={`font-bold uppercase ${o.status === 'accepted' ? 'text-emerald-700' : o.status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                      {o.status === 'accepted' ? 'Aceptada' : o.status === 'rejected' ? 'Rechazada' : o.status === 'converted' ? 'Convertida a pedido' : 'Pendiente'}
                    </span>
                  </p>
                </div>
                {o.status === 'accepted' && (
                  <button
                    onClick={() => {
                      convertOffer(o.id)
                        .then((orderId) => navigate(`/pedidos/${orderId}`))
                        .catch((err) => setOfferMsg(errorMessage(err)))
                        .finally(() => refreshOffers());
                    }}
                    className="rounded-lg bg-brand-900 text-white font-semibold px-4 py-2 hover:bg-brand-700"
                  >
                    Comprar ahora
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
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
          text="Cuando compres un producto, aparecerá aquí con su seguimiento."
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
                  {formatDate(o.created_at)} · {o.items.length} producto(s) ·{' '}
                  {o.payment_method?.name ?? '—'}
                </p>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-3 py-1">
                {orderStatusLabel(o.status)}
              </span>
              <p className="font-extrabold text-brand-950">{clp(o.total)}</p>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
