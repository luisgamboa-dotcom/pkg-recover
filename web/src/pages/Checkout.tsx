import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';
import { fetchTiers, tierPrice, useLotsByIds, type PriceTier } from '../data/shop';
import {
  createOrder,
  useAddresses,
  usePaymentMethods,
} from '../data/account';
import { cop, totals } from '../lib/format';
import {
  LIMITS,
  checkMax,
  checkPhone,
  checkRequired,
  sanitizeText,
} from '../lib/validation';

const CITIES = ['Bogotá D.C.', 'Medellín', 'Cali', 'Barranquilla', 'Otra'];

export default function Checkout() {
  return (
    <ProtectedRoute>
      <CheckoutForm />
    </ProtectedRoute>
  );
}

function CheckoutForm() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { items, clear } = useCart();
  const { map, loading: lotsLoading } = useLotsByIds(items.map((i) => i.lotId));
  const { items: addresses } = useAddresses(user?.id);
  const paymentMethods = usePaymentMethods();
  const [tiersMap, setTiersMap] = useState<Record<string, PriceTier[]>>({});
  const isReseller = profile?.roleCode === 'reseller';
  const idsKey = items.map((i) => i.lotId).sort().join(',');

  useEffect(() => {
    if (!isReseller) return;
    fetchTiers(items.map((i) => i.lotId)).then(setTiersMap).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, isReseller]);

  const [addressId, setAddressId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState(CITIES[0]);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lines = items
    .map((i) => ({ item: i, lot: map[i.lotId] }))
    .filter((l) => l.lot);
  const priceFor = (lotId: string, qty: number, base: number) =>
    isReseller ? tierPrice(tiersMap[lotId] ?? [], qty, base) : base;
  const subtotal = lines.reduce(
    (a, l) => a + priceFor(l.lot!.id, l.item.qty, l.lot!.base_price) * l.item.qty,
    0,
  );
  const t = totals(subtotal);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentId);
  const needsCard = selectedMethod?.code === 'card';

  function pickAddress(id: string) {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) {
      setRecipient(a.recipient_name);
      setPhone(a.phone);
      setCity(a.city);
      setAddress(a.address_line);
      setNotes(a.delivery_notes ?? '');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (lines.length === 0) {
      setError('El carrito está vacío o los lotes ya no están disponibles.');
      return;
    }
    // Sanitiza primero: lo limpio es lo que se valida y lo que se guarda.
    const clean = {
      recipient: sanitizeText(recipient, 150),
      phone: sanitizeText(phone, LIMITS.phone),
      city: sanitizeText(city, LIMITS.city),
      address: sanitizeText(address, LIMITS.address),
      notes: sanitizeText(notes, LIMITS.notes),
    };
    const fieldErr =
      checkRequired(clean.recipient, 'Destinatario', 2, 150) ??
      checkPhone(clean.phone) ??
      checkRequired(clean.address, 'Dirección', 5, LIMITS.address) ??
      checkMax(clean.notes, 'Notas', LIMITS.notes);
    if (fieldErr) {
      setError(fieldErr);
      return;
    }
    if (!CITIES.includes(clean.city)) {
      setError('Ciudad inválida.');
      return;
    }
    if (!paymentId) {
      setError('Selecciona un método de pago.');
      return;
    }
    // Los datos de tarjeta SOLO se validan en formato y nunca salen del
    // navegador: no se envían a Supabase ni a ningún backend (prompt §14).
    const cardDigits = cardNumber.replace(/\D/g, '').slice(0, 19);
    if (
      needsCard &&
      (cardDigits.length < 12 || !/^\d{2}\/\d{2}$/.test(cardExp.trim()) || !/^\d{3,4}$/.test(cardCvv.trim()))
    ) {
      setError('Revisa los datos de la tarjeta.');
      return;
    }
    setBusy(true);
    try {
      // El cobro real vía pasarela se integra en la siguiente sección.
      // cardNumber/cardExp/cardCvv NO se incluyen en ningún payload.
      const orderId = await createOrder({
        buyerId: user.id,
        paymentMethodId: paymentId,
        shippingCost: t.shipping,
        taxAmount: t.tax,
        ship: {
          recipient: clean.recipient,
          phone: clean.phone,
          city: clean.city,
          address: clean.address,
          notes: clean.notes,
          addressId: addressId || null,
        },
        items: lines.map((l) => ({
          lotId: l.lot!.id,
          qty: l.item.qty,
          unitPrice: priceFor(l.lot!.id, l.item.qty, l.lot!.base_price),
        })),
      });
      clear();
      navigate(`/pedidos/${orderId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (lotsLoading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Cargando…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Finalizar compra" subtitle="Envío, pago y resumen." />
      {lines.length === 0 ? (
        <EmptyState title="Nada que pagar" text="Tu carrito está vacío." />
      ) : (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-brand-950">📦 Dirección de envío</h2>
              {addresses.length > 0 && (
                <select
                  className="field-input mt-3"
                  value={addressId}
                  onChange={(e) => pickAddress(e.target.value)}
                  aria-label="Usar dirección guardada"
                >
                  <option value="">Escribir una nueva…</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label ?? 'Dirección'} — {a.address_line} ({a.city})
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="co-name">Nombre completo / empresa</label>
                  <input id="co-name" className="field-input" maxLength={150} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="co-phone">Teléfono de contacto</label>
                  <input id="co-phone" className="field-input" maxLength={LIMITS.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="co-city">Ciudad</label>
                  <select id="co-city" className="field-input" value={city} onChange={(e) => setCity(e.target.value)}>
                    {CITIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="co-addr">Dirección exacta</label>
                  <input id="co-addr" className="field-input" maxLength={LIMITS.address} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="co-notes">Notas de entrega (opcional)</label>
                  <input id="co-notes" className="field-input" maxLength={LIMITS.notes} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold text-brand-950">💳 Método de pago</h2>
              <div className="mt-3 space-y-2">
                {paymentMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`block rounded-xl border p-3 cursor-pointer ${paymentId === m.id ? 'border-brand-900 bg-brand-50' : 'border-slate-200'}`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-sm">
                      <input
                        type="radio"
                        name="pay"
                        className="accent-[#1a365d]"
                        checked={paymentId === m.id}
                        onChange={() => setPaymentId(m.id)}
                      />
                      {m.name}
                    </span>
                    {m.description && (
                      <span className="block text-xs text-slate-500 mt-0.5 ml-6">
                        {m.description}
                      </span>
                    )}
                  </label>
                ))}
                {paymentMethods.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Sin métodos configurados (aplica el seed de la migración 3).
                  </p>
                )}
              </div>
              {needsCard && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="field-label" htmlFor="cc-num">Número de tarjeta</label>
                    <input
                      id="cc-num"
                      className="field-input"
                      inputMode="numeric"
                      maxLength={23}
                      placeholder="4111 1111 1111 1111"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label" htmlFor="cc-exp">Vencimiento (MM/AA)</label>
                    <input id="cc-exp" className="field-input" maxLength={5} placeholder="12/28" value={cardExp} onChange={(e) => setCardExp(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="cc-cvv">CVV</label>
                    <input id="cc-cvv" className="field-input" inputMode="numeric" maxLength={4} placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                  </div>
                  <p className="sm:col-span-3 text-xs text-slate-500">
                    🔒 Pago SSL seguro. Los datos de tarjeta no se almacenan.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
            <h2 className="font-bold text-brand-950">Resumen del pedido</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map(({ item, lot }) => {
                const unit = priceFor(lot!.id, item.qty, lot!.base_price);
                return (
                  <li key={item.lotId} className="flex justify-between gap-2">
                    <span className="text-slate-600">
                      {lot!.title} × {item.qty}
                      {unit < lot!.base_price && (
                        <span className="block text-xs text-emerald-700">Precio revendedor aplicado</span>
                      )}
                    </span>
                    <span className="font-semibold whitespace-nowrap">
                      {cop(unit * item.qty)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-3 space-y-1.5 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-semibold">{cop(t.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Envío</dt>
                <dd className="font-semibold">{cop(t.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA 19%</dt>
                <dd className="font-semibold">{cop(t.tax)}</dd>
              </div>
              <div className="flex justify-between text-base font-extrabold text-brand-950 border-t border-slate-200 pt-2">
                <dt>Total</dt>
                <dd>{cop(t.total)}</dd>
              </div>
            </dl>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="mt-4 w-full rounded-lg bg-brand-900 text-white font-semibold py-3 hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Procesando…' : '🔒 Finalizar compra'}
            </button>
            <p className="mt-2 text-xs text-slate-400 text-center">
              Al completar aceptas los Términos. El pedido queda pendiente de
              pago hasta integrar la pasarela.
            </p>
            <Link to="/carrito" className="mt-1 block text-center text-sm text-brand-900 underline">
              Volver al carrito
            </Link>
          </aside>
        </form>
      )}
    </Layout>
  );
}
