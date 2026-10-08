import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import {
  ConfigNotice,
  EmptyState,
  ProductBadges,
  ProductCard,
  ProductImage,
} from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';
import {
  addReview,
  useFavorites,
  useProduct,
  usePriceTiers,
  useProductTimeline,
  useReviews,
  useSimilarProducts,
} from '../data/shop';
import { findSellerForProduct, sendMessage, useMyOrders } from '../data/account';
import {
  clp,
  discountPct,
  formatDate,
  packagingLabel,
  productStateLabel,
} from '../lib/format';
import {
  errorMessage,
  LIMITS,
  checkMax,
  checkRequired,
  parseQty,
  sanitizeMultiline,
  sanitizeText,
} from '../lib/validation';

const STAGE_LABEL: Record<string, string> = {
  registrado: 'Registrado',
  recibido: 'Recibido',
  clasificado: 'Clasificado',
  verificado: 'Verificado',
  publicado: 'Publicado',
  vendido: 'Vendido',
};

const STAGE_ICON: Record<string, string> = {
  registrado: '📝',
  recibido: '📦',
  clasificado: '🔍',
  verificado: '✓',
  publicado: '📢',
  vendido: '🛒',
};

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-brand-950">{value}</p>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { product, loading, error, configured } = useProduct(id);
  const similar = useSimilarProducts(product);
  const tiers = usePriceTiers(product?.id);
  const { ids: favIds, toggle } = useFavorites(user?.id);
  const { items: reviews } = useReviews(product?.id);
  const { orders } = useMyOrders(user?.id);
  const timeline = useProductTimeline(product?.id);
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
        <p className="text-sm text-slate-500">Cargando producto…</p>
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
  if (error || !product) {
    return (
      <Layout>
        <EmptyState title="Producto no encontrado" text={error ?? 'Revisa el catálogo.'} />
      </Layout>
    );
  }

  const discount = discountPct(product.base_price, product.msrp_reference);
  const isFav = favIds.has(product.id);
  const boughtOrder = orders.find(
    (o) =>
      !['cancelled', 'returned'].includes(o.status) &&
      o.items.some((i) => i.product?.id === product.id),
  );
  const dims =
    product.length_cm && product.width_cm && product.height_cm
      ? `${product.length_cm} × ${product.width_cm} × ${product.height_cm} cm`
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
        productId: product!.id,
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
      setReviewMsg(errorMessage(err));
    }
  }

  return (
    <Layout>
      <p className="text-sm text-slate-500 mb-4">
        <Link to="/catalogo" className="hover:underline">
          Catálogo
        </Link>{' '}
        / {product.categories[0]?.name ?? 'Productos'} /{' '}
        <span className="text-brand-950 font-medium">{product.sku}</span>
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <ProductImage product={product} className="w-full aspect-square rounded-2xl border border-slate-200" />
          {product.imageUrls.length > 1 && (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {product.imageUrls.slice(1, 6).map((src) => (
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
          <ProductBadges product={product} />
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-950">
            {product.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-mono">SKU: {product.sku}</p>
          {product.company != null ? (
            <p className="mt-1 text-sm text-slate-500">
              Proveedor:{' '}
              <Link to={`/empresas/${product.company.id}`} className="font-semibold text-brand-900 hover:underline">
                {product.company.name}
              </Link>{' '}
              {product.company.is_verified && (
                <span className="text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Verificada</span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">Sin proveedor asignado temporalmente.</p>
          )}

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-brand-950">
              {clp(product.base_price)}
            </span>
            {product.msrp_reference != null && (
              <span className="text-slate-400 line-through">
                {clp(product.msrp_reference)}
              </span>
            )}
            {discount != null && (
              <span className="text-sm font-bold text-accent-600">
                Ahorras {discount}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            ≈ {clp(Math.round(product.base_price / product.unit_count))} por unidad · Precios
            sin IVA ni envío · {product.stock_quantity} producto(s) disponibles
          </p>
          {isReseller && tiers.length > 0 && (
            <div className="mt-3 rounded-xl bg-white border border-brand-100 p-3 text-sm shadow-sm">
              <p className="font-bold text-brand-950">Precio revendedor por volumen</p>
              <ul className="mt-1 space-y-0.5">
                {tiers.map((t) => (
                  <li key={t.id} className={qty >= t.min_quantity ? 'font-bold text-success-700' : 'text-slate-600'}>
                    Desde {t.min_quantity} uds → {clp(t.unit_price)}/producto
                    {qty >= t.min_quantity && ' ✓ aplicado en caja'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.description && (
            <p className="mt-4 text-slate-600">{product.description}</p>
          )}

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Spec label="Unidades" value={`${product.unit_count} uds`} />
            <Spec label="Peso total" value={`${product.total_weight_kg} kg`} />
            <Spec label="Dimensiones" value={dims} />
            <Spec label="Empaque" value={packagingLabel(product.packaging_state)} />
            <Spec label="Producto" value={productStateLabel(product.product_state)} />
            <Spec
              label="Ubicación"
              value={
                product.warehouse
                  ? `${product.warehouse.name}${product.warehouse_zone ? ` · ${product.warehouse_zone}` : ''}`
                  : '—'
              }
            />
          </div>

          {(product.circularity_percent != null || product.waste_avoided_kg != null) && (
            <p className="mt-3 text-sm rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 p-3">
              ♻️ Circularidad {product.circularity_percent ?? '—'}% · evita{' '}
              {product.waste_avoided_kg ?? '—'} kg de desecho.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">
              Cantidad{' '}
              <input
                type="number"
                min={1}
                max={Math.max(product.stock_quantity, 1)}
                value={qty}
                onChange={(e) =>
                  setQty(parseQty(e.target.value, Math.max(product.stock_quantity, 1)))
                }
                className="field-input w-20! inline-block ml-1"
              />
            </label>
            <button
              onClick={() => {
                // Invitados: el carrito exige cuenta → van a iniciar sesión.
                if (!user) {
                  navigate('/login', { replace: true });
                  return;
                }
                add(product.id, qty);
                setAdded(true);
              }}
              className="rounded-lg bg-accent-500 text-white font-semibold px-6 py-3 hover:bg-accent-600"
            >
              Agregar al carrito
            </button>
            {user && (
              <button
                onClick={() => void toggle(product.id)}
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
                findSellerForProduct(product.id, user.id)
                  .then((sellerId) => sendMessage(product.id, user.id, sellerId, clean).then(() => sellerId))
                  .then((sellerId) => {
                    setInquiryBusy(false);
                    if (sellerId == null) {
                      setInquiry('');
                      setInquiryMsg('Este producto está sin proveedor: tu consulta quedó en administración como “Sin destinatario”.');
                      return;
                    }
                    navigate('/mensajes');
                  })
                  .catch((err) => {
                    setInquiryMsg(errorMessage(err));
                    setInquiryBusy(false);
                  });
              }}
            >
              <label className="field-label" htmlFor="inquiry">Consultar al vendedor</label>
              {product.company == null && (
                <p className="mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Producto temporalmente sin proveedor: tu consulta irá a administración con la etiqueta “Sin destinatario”.
                </p>
              )}
              <div className="flex gap-2">
                <input
                  id="inquiry"
                  className="field-input min-w-0 flex-1"
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

      {/* Trazabilidad */}
      {timeline.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-brand-950">Trazabilidad</h2>
          <p className="mt-1 text-sm text-slate-500">Del desecho a tus manos: historial verificable de este producto.</p>
          <ol className="mt-4 relative space-y-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timeline.map((ev) => (
              <li key={ev.id} className="relative flex gap-3">
                <span className="relative z-10 grid place-items-center w-7 h-7 rounded-full bg-brand-900 text-white text-sm shrink-0" aria-hidden>
                  {STAGE_ICON[ev.stage] ?? '•'}
                </span>
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex-1">
                  <p className="font-bold text-brand-950 text-sm">
                    {STAGE_LABEL[ev.stage] ?? ev.stage}
                    <span className="ml-2 font-normal text-xs text-slate-400">{formatDate(ev.created_at)}</span>
                  </p>
                  {ev.detail && <p className="text-sm text-slate-600">{ev.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reseñas */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-brand-950">
          Reseñas{' '}
          <span className="text-sm font-normal text-slate-500">
            {product.avgRating != null
              ? `★ ${product.avgRating.toFixed(1)} (${product.reviewsCount})`
              : '(sin calificaciones)'}
          </span>
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="text-sm text-slate-500">
                Aún no hay reseñas para este producto.
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
                  placeholder="Cuéntanos sobre el producto…"
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
          <h2 className="text-xl font-bold text-brand-950">Productos similares</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((l) => (
              <ProductCard key={l.id} product={l} />
            ))}
          </div>
        </section>
      )}
    </Layout>
  );
}


