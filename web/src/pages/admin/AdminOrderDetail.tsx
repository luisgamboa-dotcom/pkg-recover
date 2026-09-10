import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { useOrder } from '../../data/account';
import { cop, formatDate, orderStatusLabel } from '../../lib/format';
import { addShipmentEvent, saveShipment, updateOrderStatus } from '../../data/admin';
import { sanitizeText } from '../../lib/validation';

const ORDER_STATUS = ['pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned'];
const SHIP_STATUS = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'];

export default function AdminOrderDetail() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <Detail />
      </AdminLayout>
    </RequireAdmin>
  );
}

function Detail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { order, shipment, loading } = useOrder(id, user?.id);
  const [msg, setMsg] = useState<string | null>(null);
  const [carrier, setCarrier] = useState('RecuperaLogistics');
  const [tracking, setTracking] = useState('');
  const [shipStatus, setShipStatus] = useState('pending');
  const [evStatus, setEvStatus] = useState('in_transit');
  const [evLocation, setEvLocation] = useState('');

  useEffect(() => {
    if (shipment) {
      setCarrier(shipment.carrier);
      setTracking(shipment.tracking_number ?? '');
      setShipStatus(shipment.status);
    }
  }, [shipment]);

  if (loading) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (!order) return <EmptyState title="Pedido no encontrado" text="Revisa el listado." />;

  async function onStatus(e: FormEvent) {
    e.preventDefault();
    const sel = (e.target as HTMLFormElement).querySelector('select')?.value;
    if (!sel || !id) return;
    try {
      await updateOrderStatus(id, sel);
      setMsg(`Estado del pedido → ${orderStatusLabel(sel)}. Recarga para ver el cambio.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function onShipment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const cleanCarrier = sanitizeText(carrier, 100) || 'RecuperaLogistics';
    const cleanTracking = sanitizeText(tracking, 100);
    if (!/^[A-Za-z0-9-]{0,100}$/.test(cleanTracking)) {
      setMsg('Seguimiento inválido (solo letras, números y guiones).');
      return;
    }
    try {
      await saveShipment(id, { carrier: cleanCarrier, tracking_number: cleanTracking || null, status: shipStatus }, shipment?.id);
      setMsg('Despacho guardado. Recarga para ver el cambio.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function onEvent(e: FormEvent) {
    e.preventDefault();
    if (!shipment) { setMsg('Guarda primero el despacho.'); return; }
    try {
      await addShipmentEvent(shipment.id, evStatus, sanitizeText(evLocation, 200));
      setEvLocation('');
      setMsg('Evento de seguimiento registrado. Recarga para ver el cambio.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <p className="text-sm text-slate-500 mb-3">
        <Link to="/admin/pedidos" className="hover:underline">Pedidos</Link> /{' '}
        <span className="font-mono font-bold text-brand-950">{order.order_number}</span>
      </p>
      <PageHeader title={`Pedido ${order.order_number}`} subtitle={`${formatDate(order.created_at)} · ${order.ship_recipient_name} · ${order.ship_city}`} />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-bold text-brand-950">Estado del pedido</h2>
          <form onSubmit={onStatus} className="mt-2 flex gap-2">
            <select className="field-input" defaultValue={order.status} aria-label="Estado del pedido">
              {ORDER_STATUS.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
            </select>
            <button className="rounded-lg bg-brand-900 text-white px-4 font-semibold shrink-0">Actualizar</button>
          </form>
          <h2 className="mt-5 font-bold text-brand-950">Detalle ({cop(order.total)})</h2>
          <ul className="mt-2 text-sm space-y-1">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>{i.lot?.title ?? 'Lote'} × {i.quantity}</span>
                <span className="font-semibold">{cop(i.line_total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl border p-5">
          <h2 className="font-bold text-brand-950">Despacho</h2>
          <form onSubmit={onShipment} className="mt-2 grid grid-cols-2 gap-2">
            <input className="field-input" maxLength={100} placeholder="Transportadora" value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Transportadora" />
            <input className="field-input" maxLength={100} placeholder="N° seguimiento" value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="Seguimiento" />
            <select className="field-input col-span-2" value={shipStatus} onChange={(e) => setShipStatus(e.target.value)} aria-label="Estado del despacho">
              {SHIP_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="rounded-lg bg-brand-900 text-white px-4 py-2.5 font-semibold col-span-2">Guardar despacho</button>
          </form>
          <h2 className="mt-4 font-bold text-brand-950 text-sm">Agregar evento de seguimiento</h2>
          <form onSubmit={onEvent} className="mt-2 flex gap-2">
            <select className="field-input" value={evStatus} onChange={(e) => setEvStatus(e.target.value)} aria-label="Evento">
              {SHIP_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="field-input" maxLength={200} placeholder="Ubicación" value={evLocation} onChange={(e) => setEvLocation(e.target.value)} aria-label="Ubicación" />
            <button className="rounded-lg border px-4 font-semibold shrink-0">+</button>
          </form>
        </section>
      </div>
    </>
  );
}
