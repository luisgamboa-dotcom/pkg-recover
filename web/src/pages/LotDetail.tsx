import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  ConfigNotice,
  EmptyState,
  LotBadges,
  LotCard,
  LotImage,
} from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';
import {
  addReview,
  useFavorites,
  useLot,
  usePriceTiers,
  useReviews,
  useSimilarLots,
} from '../data/shop';
import { findSellerForLot, sendMessage, useMyOrders } from '../data/account';
import {
  cop,
  discountPct,
  formatDate,
  packagingLabel,
  productStateLabel,
} from '../lib/format';
import {
  LIMITS,
  checkMax,
  checkRequired,
  parseQty,
  sanitizeMultiline,
  sanitizeText,
} from '../lib/validation';

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brand-50 border border-slate-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-brand-950">{value}</p>
    </div>
  );
}

export default function LotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { lot, loading, error, configured } = useLot(id);
  const similar = useSimilarLots(lot);
  const tiers = usePriceTiers(lot?.id);
  const { ids: favIds, toggle } = useFavorites(user?.id);
  const { items: reviews } = useReviews(lot?.id);
  const { orders } = useMyOrders(user?.id);
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [inquiry, setInquiry] = useState('');
  const [inquiryMsg, setInquiryMsg] = useState<string | null>(null);
  const [inquiryBusy, setInquiryBusy] = useState(false);
  const isReseller = profile?.roleCode === 'reseller';

  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Cargando lote…</p>
      </Layout>
    );
  }
  if (!configured) {
    return (
      <Layout>
        <ConfigNotice />
      </Layout>
    );
  }
  if (error || !lot) {
    return (
      <Layout>
        <EmptyState title="Lote no encontrado" text={error ?? 'Revisa el catálogo.'} />
      </Layout>
    );
  }

  const discount = discountPct(lot.base_price, lot.msrp_reference);
  const isFav = favIds.has(lot.id);
  const boughtOrder = orders.find(
    (o) =>
      !['cancelled', 'returned'].includes(o.status) &&
      o.items.some((i) => i.lot?.id === lot.id),
  );
  const dims =
    lot.length_cm && lot.width_cm && lot.height_cm
      ? `${lot.length_cm} × ${lot.width_cm} × ${lot.height_cm} cm`
      : '—';

  async function onReview(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setReviewMsg(null);
    // Reseñas = contenido público: sanitiza y limita antes de guardar.
    const cleanTitle = sanitizeText(reviewTitle, LIMITS.title);
    const cleanComment = sanitizeMultiline(reviewComment, LIMITS.comment);
    const safeRating = Math.min(Math.max(Math.floor(Number(rating) || 0), 1), 5);
    const titleErr = checkMax(cleanTitle, 'Título', LIMITS.title);
    const commentErr = checkRequired(cleanComment, 'Comentario', 1, LIMITS.comment);
    if (titleErr ?? commentErr) {
      setReviewMsg(titleErr ?? commentErr);
      return;
    }
    try {
      await addReview({
        lotId: lot!.id,
        profileId: user.id,
        orderId: boughtOrder?.id ?? null,
        rating: safeRating,
        title: cleanTitle,
        comment: cleanComment,
        verified: Boolean(boughtOrder),
      });
      setReviewTitle('');
      setReviewComment('');
      setReviewMsg('Reseña publicada. ¡Gracias!');
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Layout>
      <p className="text-sm text-slate-500 mb-4">
        <Link to="/catalogo" className="hover:underline">
          Catálogo
        </Link>{' '}
        / {lot.categories[0]?.name ?? 'Lotes'} /{' '}
        <span className="text-brand-950 font-medium">{lot.sku}</span>
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <LotImage lot={lot} className="w-full aspect-square rounded-2xl border border-slate-200" />
          {lot.imageUrls.length > 1 && (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {lot.imageUrls.slice(1, 6).map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="aspect-square object-cover rounded-lg border border-slate-200"
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <LotBadges lot={lot} />
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-950">
            {lot.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-mono">SKU: {lot.sku}</p>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand-950">
              {cop(lot.base_price)}
            </span>
            {lot.msrp_reference != null && (
              <span className="text-slate-400 line-through">
                {cop(lot.msrp_reference)}
              </span>
            )}
            {discount != null && (
              <span className="text-sm font-bold text-accent-600">
                Ahorras {discount}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            ≈ {cop(Math.round(lot.base_price / lot.unit_count))} por unidad · Precios
            sin IVA ni envío · {lot.stock_quantity} lote(s) disponibles
          </p>
          {isReseller && tiers.length > 0 && (
            <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 p-3 text-sm">
              <p className="font-bold text-brand-950">Precio revendedor por volumen</p>
              <ul className="mt-1 space-y-0.5">
                {tiers.map((t) => (
                  <li key={t.id} className={qty >= t.min_quantity ? 'font-bold text-success-700' : 'text-slate-600'}>
                    Desde {t.min_quantity} uds → {cop(t.unit_price)}/lote
                    {qty >= t.min_quantity && ' ✓ aplicado en caja'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lot.description && (
            <p className="mt-4 text-slate-600">{lot.description}</p>
          )}

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Spec label="Unidades" value={`${lot.unit_count} uds`} />
            <Spec label="Peso total" value={`${lot.total_weight_kg} kg`} />
            <Spec label="Dimensiones" value={dims} />
            <Spec label="Empaque" value={packagingLabel(lot.packaging_state)} />
            <Spec label="Producto" value={productStateLabel(lot.product_state)} />
            <Spec
              label="Ubicación"
              value={
                lot.warehouse
                  ? `${lot.warehouse.name}${lot.warehouse_zone ? ` · ${lot.warehouse_zone}` : ''}`
                  : '—'
              }
            />
          </div>

          {(lot.circularity_percent != null || lot.waste_avoided_kg != null) && (
            <p className="mt-3 text-sm rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-3">
              ♻️ Circularidad {lot.circularity_percent ?? '—'}% · evita{' '}
              {lot.waste_avoided_kg ?? '—'} kg de desecho.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">
              Cantidad{' '}
              <input
                type="number"
                min={1}
                max={Math.max(lot.stock_quantity, 1)}
                value={qty}
                onChange={(e) =>
                  setQty(parseQty(e.target.value, Math.max(lot.stock_quantity, 1)))
                }
                className="field-input !w-20 inline-block ml-1"
              />
            </label>
            <button
              onClick={() => {
                add(lot.id, qty);
                setAdded(true);
              }}
              className="rounded-lg bg-accent-500 text-white font-semibold px-6 py-3 hover:bg-accent-600"
            >
              Agregar al carrito
            </button>
            {user && (
              <button
                onClick={() => void toggle(lot.id)}
                aria-pressed={isFav}
                className={`rounded-lg border px-4 py-3 font-semibold ${
                  isFav
                    ? 'border-accent-500 text-accent-600'
                    : 'border-slate-300 text-brand-950'
                }`}
              >
                {isFav ? '♥ En favoritos' : '♡ Favorito'}
              </button>
            )}
          </div>
          {added && (
            <p className="mt-2 text-sm text-emerald-700">
              Agregado. <Link to="/carrito" className="font-semibold underline">Ir al carrito</Link>
            </p>
          )}
          {user && (
            <form
              className="mt-4 rounded-xl border border-slate-200 bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const clean = sanitizeText(inquiry, LIMITS.message);
                if (clean.length < 3) {
                  setInquiryMsg('Escribe un mensaje de al menos 3 caracteres.');
                  return;
                }
                setInquiryBusy(true);
                findSellerForLot(lot.id, user.id)
                  .then((sellerId) => sendMessage(lot.id, user.id, sellerId, clean))
                  .then(() => navigate('/mensajes'))
                  .catch((err) => {
                    setInquiryMsg(err instanceof Error ? err.message : String(err));
                    setInquiryBusy(false);
                  });
              }}
            >
              <label className="field-label" htmlFor="inquiry">Consultar al vendedor</label>
              <div className="flex gap-2">
                <input
                  id="inquiry"
                  className="field-input"
                  maxLength={LIMITS.message}
                  placeholder="¿El precio incluye el envío a mi ciudad?"
                  value={inquiry}
                  onChange={(e) => setInquiry(e.target.value)}
                />
                <button disabled={inquiryBusy} className="rounded-lg bg-brand-900 text-white px-4 font-semibold shrink-0 disabled:opacity-50">
                  {inquiryBusy ? '…' : 'Enviar'}
                </button>
              </div>
              {inquiryMsg && <p className="mt-1 text-xs text-slate-500">{inquiryMsg}</p>}
            </form>
          )}
        </div>
      </div>

      {/* Reseñas */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-brand-950">
          Reseñas{' '}
          <span className="text-sm font-normal text-slate-500">
            {lot.avgRating != null
              ? `★ ${lot.avgRating.toFixed(1)} (${lot.reviewsCount})`
              : '(sin calificaciones)'}
          </span>
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="text-sm text-slate-500">
                Aún no hay reseñas para este lote.
              </p>
            )}
            {reviews.map((r) => (
              <article key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-brand-950">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}{' '}
                  <span className="font-normal text-slate-500">{r.author}</span>
                  {r.is_verified_purchase && (
                    <span className="ml-2 text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                      Compra verificada
                    </span>
                  )}
                </p>
                {r.title && <p className="mt-1 font-semibold text-sm">{r.title}</p>}
                {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
                <p className="mt-1 text-xs text-slate-400">{formatDate(r.created_at)}</p>
              </article>
            ))}
          </div>
          <div>
            {user ? (
              <form onSubmit={onReview} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h3 className="font-bold text-brand-950">Escribe tu reseña</h3>
                <label className="block text-sm">
                  <span className="field-label">Calificación</span>
                  <select
                    className="field-input"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} estrellas
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="field-input"
                  maxLength={LIMITS.title}
                  placeholder="Título (opcional)"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                />
                <textarea
                  className="field-input"
                  rows={3}
                  maxLength={LIMITS.comment}
                  placeholder="Cuéntanos sobre el lote…"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
                {reviewMsg && <p className="text-sm text-slate-600">{reviewMsg}</p>}
                <button className="rounded-lg bg-brand-900 text-white font-semibold px-5 py-2.5 hover:bg-brand-700">
                  Publicar
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">
                <Link to="/login" className="font-semibold text-brand-900 underline">
                  Inicia sesión
                </Link>{' '}
                para escribir una reseña.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Relacionados */}
      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-brand-950">Lotes similares</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((l) => (
              <LotCard key={l.id} lot={l} />
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}


