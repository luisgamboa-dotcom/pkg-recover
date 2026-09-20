import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { createTicket, requestPayment, useOrder } from '../data/account';
import {
  clp,
  formatAddress,
  formatDate,
  orderStatusLabel,
  shipmentStatusLabel,
} from '../lib/format';

const TRACK_STEPS = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

/** Guía de pago: a dónde ir y cómo proceder según el método elegido. */
function PayPanel({
  orderId,
  userId,
  methodCode,
  methodName,
  total,
}: {
  orderId: string;
  userId: string;
  methodCode: string | null;
  methodName: string;
  total: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [transferSent, setTransferSent] = useState(false);
  const gateway = methodCode === 'card' || methodCode === 'webpay';

  async function payNow() {
    setBusy(true);
    setMsg(null);
    const attempt = await requestPayment(orderId);
    if (attempt.kind === 'redirect') {
      window.location.href = attempt.url;
      return;
    }
    setBusy(false);
    if (attempt.reason === 'gateway_not_configured') {
      setMsg(
        'El pago en línea aún no está habilitado en la tienda. Tu pedido quedó reservado como pendiente: te contactaremos para completar el cobro o abre un ticket de soporte.',
      );
    } else {
      setMsg('No se pudo iniciar el cobro. Inténtalo de nuevo o contáctanos por soporte.');
    }
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-accent-500 bg-accent-500/5 p-4">
      <h2 className="font-bold text-brand-950">💳 Completa tu pago · {clp(total)}</h2>
      {gateway && (
        <>
          <ol className="mt-2 text-sm text-slate-600 space-y-1 list-decimal list-inside">
            <li>Pulsa <strong>Pagar ahora</strong>: te llevamos a la pasarela segura ({methodName}).</li>
            <li>Completa tu {methodCode === 'webpay' ? 'Webpay con tus claves bancarias' : 'tarjeta'} en ese sitio (nunca vemos tus datos).</li>
            <li>Volverás automáticamente y el pedido pasará a <strong>pagado</strong>.</li>
          </ol>
          <button
            onClick={() => void payNow()}
            disabled={busy}
            className="mt-3 rounded-lg bg-accent-500 text-white font-semibold px-6 py-3 hover:bg-accent-600 disabled:opacity-50"
          >
            {busy ? 'Conectando…' : 'Pagar ahora'}
          </button>
        </>
      )}
      {methodCode === 'bank_transfer' && (
        <>
          <ol className="mt-2 text-sm text-slate-600 space-y-1 list-decimal list-inside">
            <li>Te contactaremos al correo/teléfono de la dirección con los datos de transferencia.</li>
            <li>Realiza la transferencia por el total ({clp(total)}).</li>
            <li>Pulsa <strong>Ya transferí</strong>: avisamos al equipo con tu pedido vinculado.</li>
            <li>Al validar el pago, tu pedido pasa a <strong>pagado</strong> y se prepara el despacho.</li>
          </ol>
          <button
            onClick={() => void (async () => {
              setBusy(true);
              setMsg(null);
              try {
                await createTicket({
                  profileId: userId,
                  orderId,
                  subject: 'Aviso de transferencia realizada',
                  category: 'payment',
                  message: `Realicé la transferencia por ${clp(total)}. Quedo atento a la validación.`,
                });
                setTransferSent(true);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'No se pudo avisar. Inténtalo de nuevo.');
              } finally {
                setBusy(false);
              }
            })()}
            disabled={busy || transferSent}
            className="mt-3 rounded-lg bg-brand-900 text-white font-semibold px-6 py-3 hover:bg-brand-700 disabled:opacity-50"
          >
            {transferSent ? '✓ Aviso enviado' : 'Ya transferí, avisar'}
          </button>
        </>
      )}
      {methodCode === 'cash_on_delivery' && (
        <ol className="mt-2 text-sm text-slate-600 space-y-1 list-decimal list-inside">
          <li>No debes hacer nada ahora: pagas en efectivo o QR <strong>al recibir</strong>.</li>
          <li>Te contactaremos para coordinar la entrega.</li>
        </ol>
      )}
      {!gateway && methodCode !== 'bank_transfer' && methodCode !== 'cash_on_delivery' && (
        <p className="mt-2 text-sm text-slate-600">
          Método: {methodName}. Si tienes dudas, contáctanos por <Link to="/ayuda" className="underline font-semibold">soporte</Link>.
        </p>
      )}
      {msg && <p role="status" className="mt-2 text-sm text-slate-700 bg-white border rounded-lg p-3">{msg}</p>}
    </div>
  );
}

export default function OrderDetail() {
  return (
    <ProtectedRoute>
      <Detail />
    </ProtectedRoute>
  );
}

const PAY_LABEL: Record<string, string> = {
  pending: 'Pago pendiente',
  approved: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Devuelto',
};

function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { order, shipment, payments, loading } = useOrder(id, user?.id);

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
            {payments.length > 0 && (
              <p className="mt-1.5 text-sm">
                <span className="font-semibold">Cobro:</span>{' '}
                {payments.map((p) => (
                  <span
                    key={p.id}
                    className={`mr-1.5 text-xs font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${
                      p.status === 'approved'
                        ? 'text-emerald-800 bg-emerald-100'
                        : 'text-amber-800 bg-amber-100'
                    }`}
                  >
                    {p.provider} · {PAY_LABEL[p.status] ?? p.status}
                  </span>
                ))}
              </p>
            )}
            {order.status === 'pending_payment' && user && (
              <PayPanel
                orderId={order.id}
                userId={user.id}
                methodCode={order.payment_method?.code ?? null}
                methodName={order.payment_method?.name ?? 'Método de pago'}
                total={order.total}
              />
            )}
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
                  <span className="font-semibold whitespace-nowrap">{clp(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{clp(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Envío</dt><dd>{clp(order.shipping_cost)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">IVA</dt><dd>{clp(order.tax_amount)}</dd></div>
              <div className="flex justify-between font-extrabold text-brand-950"><dt>Total</dt><dd>{clp(order.total)}</dd></div>
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
                    <span className="ml-2 inline-block max-w-full font-mono bg-brand-50 border border-slate-200 rounded px-2 py-0.5 break-all align-middle">
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
          <p className="text-slate-600">{formatAddress({
            street_name: order.ship_street_name,
            street_number: order.ship_street_number,
            apartment: order.ship_apartment,
            commune: order.ship_commune,
            city: order.ship_city,
            region: order.ship_region,
            postal_code: order.ship_postal_code,
          })}</p>
          <h2 className="mt-4 font-bold text-brand-950">¿Necesitas ayuda?</h2>
          <Link to="/ayuda" className="text-brand-900 font-semibold underline">
            Abrir un ticket de soporte
          </Link>
        </aside>
      </div>
    </Layout>
  );
}
