import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useOrder } from '../data/account';
import {
  cop,
  formatDate,
  orderStatusLabel,
  shipmentStatusLabel,
} from '../lib/format';

const TRACK_STEPS = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

export default function OrderDetail() {
  return (
    <ProtectedRoute>
      <Detail />
    </ProtectedRoute>
  );
}

function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { order, shipment, loading } = useOrder(id, user?.id);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Cargando pedido…</p>
      </Layout>
    );
  }
  if (!order) {
    return (
      <Layout>
        <EmptyState title="Pedido no encontrado" text="Revisa tu historial." />
      </Layout>
    );
  }

  const stepIndex = shipment ? TRACK_STEPS.indexOf(shipment.status) : -1;

  return (
    <Layout>
      <p className="text-sm text-slate-500 mb-4">
        <Link to="/pedidos" className="hover:underline">
          Mis pedidos
        </Link>{' '}
        / <span className="text-brand-950 font-medium font-mono">{order.order_number}</span>
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h1 className="font-mono font-extrabold text-xl text-brand-950">
                {order.order_number}
              </h1>
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-3 py-1">
                {orderStatusLabel(order.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(order.created_at)} · {order.payment_method?.name} ·{' '}
              {order.carrier ?? 'Transportadora por asignar'}
            </p>
            <ul className="mt-4 divide-y divide-slate-100">
              {order.items.map((i) => (
                <li key={i.id} className="py-2 flex justify-between gap-3 text-sm">
                  <span>
                    {i.lot ? (
                      <Link to={`/lotes/${i.lot.id}`} className="font-semibold text-brand-900 hover:underline">
                        {i.lot.title}
                      </Link>
                    ) : (
                      'Lote'
                    )}{' '}
                    <span className="text-slate-500">× {i.quantity}</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">{cop(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{cop(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Envío</dt><dd>{cop(order.shipping_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">IVA</dt><dd>{cop(order.tax_amount)}</dd></div>
              <div className="flex justify-between font-extrabold text-brand-950"><dt>Total</dt><dd>{cop(order.total)}</dd></div>
            </dl>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-brand-950">🚚 Seguimiento del despacho</h2>
            {!shipment && (
              <p className="mt-2 text-sm text-slate-500">
                Despacho pendiente de asignación por el equipo logístico. Te
                avisaremos cuando tenga número de seguimiento.
              </p>
            )}
            {shipment && (
              <>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{shipment.carrier}</span>
                  {shipment.tracking_number && (
                    <span className="ml-2 font-mono bg-brand-50 border border-slate-200 rounded px-2 py-0.5">
                      {shipment.tracking_number}
                    </span>
                  )}
                  <span className="ml-2 text-xs font-bold uppercase tracking-wider text-white bg-success-600 rounded-full px-2.5 py-0.5">
                    {shipmentStatusLabel(shipment.status)}
                  </span>
                </p>
                {stepIndex >= 0 && (
                  <div className="mt-4 flex items-center" aria-hidden>
                    {TRACK_STEPS.map((s, i) => (
                      <span key={s} className="flex items-center flex-1 last:flex-none">
                        <span
                          className={`grid place-items-center w-6 h-6 rounded-full text-xs font-bold ${
                            i <= stepIndex ? 'bg-success-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {i <= stepIndex ? '✓' : i + 1}
                        </span>
                        {i < TRACK_STEPS.length - 1 && (
                          <span className={`flex-1 h-1 mx-1 rounded ${i < stepIndex ? 'bg-success-600' : 'bg-slate-200'}`} />
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {shipment.events.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm">
                    {shipment.events.map((ev, i) => (
                      <li key={i} className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                        <span>
                          <span className="font-semibold">{shipmentStatusLabel(ev.status)}</span>
                          {ev.location_text && <span className="text-slate-500"> · {ev.location_text}</span>}
                        </span>
                        <span className="text-slate-400 whitespace-nowrap">{formatDate(ev.event_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="bg-white rounded-2xl border border-slate-200 p-5 h-fit text-sm">
          <h2 className="font-bold text-brand-950">Entrega</h2>
          <p className="mt-2 font-semibold">{order.ship_recipient_name}</p>
          <p className="text-slate-600">{order.ship_address_line}</p>
          <p className="text-slate-600">{order.ship_city}</p>
          <h2 className="mt-4 font-bold text-brand-950">¿Necesitas ayuda?</h2>
          <Link to="/ayuda" className="text-brand-900 font-semibold underline">
            Abrir un ticket de soporte
          </Link>
        </aside>
      </div>
    </Layout>
  );
}
