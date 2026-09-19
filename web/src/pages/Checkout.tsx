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
  quoteShipping,
  requestPayment,
  useAddresses,
  usePaymentMethods,
} from '../data/account';
import { FLAT_SHIPPING_CLP, clp, formatAddress, totals } from '../lib/format';
import AddressModal, { type AddressFormData } from '../components/AddressModal';
import {
  errorMessage,
  LIMITS,
  checkMax,
  checkPhone,
  checkPostal,
  checkRegion,
  checkRequired,
  checkStreetNumber,
  sanitizeText,
} from '../lib/validation';

const CITIES = ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Otra'];

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
  const [streetName, setStreetName] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [apartment, setApartment] = useState('');
  const [commune, setCommune] = useState('');
  const [city, setCity] = useState(CITIES[0]);
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);

  const lines = items
    .map((i) => ({ item: i, lot: map[i.lotId] }))
    .filter((l) => l.lot);
  const priceFor = (lotId: string, qty: number, base: number) =>
    isReseller ? tierPrice(tiersMap[lotId] ?? [], qty, base) : base;
  const subtotal = lines.reduce(
    (a, l) => a + priceFor(l.lot!.id, l.item.qty, l.lot!.base_price) * l.item.qty,
    0,
  );
  const totalKg = lines.reduce(
    (a, l) => a + Number(l.lot!.total_weight_kg ?? 0) * l.item.qty,
    0,
  );
  // Flete dinámico por ciudad + peso (matriz shipping_rates).
  const [shipping, setShipping] = useState(FLAT_SHIPPING_CLP);

  useEffect(() => {
    quoteShipping(city, totalKg).then(setShipping).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, totalKg]);

  const t = totals(subtotal, shipping);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentId);
  const needsCard = selectedMethod?.code === 'card';

  function pickAddress(id: string) {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) {
      setRecipient(a.recipient_name);
      setPhone(a.phone);
      setStreetName(a.street_name);
      setStreetNumber(a.street_number);
      setApartment(a.apartment ?? '');
      setCommune(a.commune);
      setCity(a.city);
      setRegion(a.region);
      setPostalCode(a.postal_code ?? '');
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
      streetName: sanitizeText(streetName, LIMITS.street),
      streetNumber: sanitizeText(streetNumber, LIMITS.streetNumber),
      apartment: sanitizeText(apartment, LIMITS.apartment),
      commune: sanitizeText(commune, LIMITS.commune),
      city: sanitizeText(city, LIMITS.city),
      region: sanitizeText(region, LIMITS.region),
      postalCode: sanitizeText(postalCode, LIMITS.postal).replace(/\D/g, ''),
      notes: sanitizeText(notes, LIMITS.notes),
    };
    const fieldErr =
      checkRequired(clean.recipient, 'Destinatario', 2, 150) ??
      checkPhone(clean.phone) ??
      checkRequired(clean.streetName, 'Calle', 2, LIMITS.street) ??
      checkStreetNumber(clean.streetNumber) ??
      checkMax(clean.apartment, 'Depto', LIMITS.apartment) ??
      checkRequired(clean.commune, 'Comuna', 2, LIMITS.commune) ??
      checkRegion(clean.region) ??
      checkPostal(clean.postalCode) ??
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
      // cardNumber/cardExp/cardCvv NO se incluyen en ningún payload.
      const orderId = await createOrder({
        buyerId: user.id,
        paymentMethodId: paymentId,
        shippingCost: t.shipping,
        taxAmount: t.tax,
        ship: {
          recipient: clean.recipient,
          phone: clean.phone,
          streetName: clean.streetName,
          streetNumber: clean.streetNumber,
          apartment: clean.apartment,
          commune: clean.commune,
          city: clean.city,
          region: clean.region,
          postalCode: clean.postalCode,
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
      // Tarjeta/Webpay: intenta el cobro por pasarela; si no está configurada
      // u otro medio, el pedido queda pendiente (se paga desde su detalle).
      const methodCode = selectedMethod?.code;
      if (methodCode === 'card' || methodCode === 'webpay') {
        const attempt = await requestPayment(orderId);
        if (attempt.kind === 'redirect') {
          window.location.href = attempt.url;
          return;
        }
      }
      navigate(`/pedidos/${orderId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
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
                      {a.label ?? 'Dirección'} — {formatAddress(a)}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-3 rounded-xl border border-slate-200 bg-brand-50 p-4">
                {recipient || streetName ? (
                  <>
                    <p className="font-bold text-brand-950">{recipient}</p>
                    <p className="text-sm text-slate-600">
                      {formatAddress({
                        street_name: streetName,
                        street_number: streetNumber,
                        apartment,
                        commune,
                        city,
                        region,
                        postal_code: postalCode,
                      })}
                    </p>
                    <p className="text-sm text-slate-600">{phone}</p>
                    {notes && <p className="text-xs text-slate-500 mt-1">{notes}</p>}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Aún no ingresas la dirección de envío.</p>
                )}
                <button
                  type="button"
                  onClick={() => setAddrOpen(true)}
                  className="mt-3 rounded-lg bg-brand-900 text-white px-5 py-2.5 font-semibold hover:bg-brand-700"
                >
                  {recipient || streetName ? 'Editar dirección' : 'Ingresar dirección'}
                </button>
              </div>
              <AddressModal
                open={addrOpen}
                title="Dirección de envío"
                submitLabel="Usar esta dirección"
                onClose={() => setAddrOpen(false)}
                initial={{
                  label: '', recipient, phone, streetName, streetNumber,
                  apartment, commune, city, region, postalCode, notes,
                  isDefault: false,
                }}
                onSubmit={(d: AddressFormData) => {
                  setRecipient(d.recipient);
                  setPhone(d.phone);
                  setStreetName(d.streetName);
                  setStreetNumber(d.streetNumber);
                  setApartment(d.apartment);
                  setCommune(d.commune);
                  setCity(d.city);
                  setRegion(d.region);
                  setPostalCode(d.postalCode);
                  setNotes(d.notes);
                  setAddressId('');
                  setAddrOpen(false);
                }}
              />
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
                      {clp(unit * item.qty)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-3 space-y-1.5 text-sm border-t border-slate-200 pt-3">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-semibold">{clp(t.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Envío <span className="text-xs">({city} · {Math.round(totalKg)} kg)</span></dt>
                <dd className="font-semibold">{clp(t.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA 19%</dt>
                <dd className="font-semibold">{clp(t.tax)}</dd>
              </div>
              <div className="flex justify-between text-base font-extrabold text-brand-950 border-t border-slate-200 pt-2">
                <dt>Total</dt>
                <dd>{clp(t.total)}</dd>
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
            <p className="mt-2 text-xs text-slate-500 text-center">
              {(selectedMethod?.code === 'card' || selectedMethod?.code === 'webpay')
                ? 'Al finalizar serás redirigido a la pasarela de pago seguro. Podrás retomar el pago desde el detalle del pedido.'
                : selectedMethod?.code === 'bank_transfer'
                  ? 'Al finalizar te contactaremos con los datos de transferencia y podrás avisar el pago desde el detalle del pedido.'
                  : selectedMethod?.code === 'cash_on_delivery'
                    ? 'Pagarás en efectivo o QR al recibir. Sin pagos anticipados.'
                    : 'Elige un método de pago para ver cómo continuar.'}
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
