/** Formato moneda COP sin decimales, como en Stitch ($1.240.000). */
export function cop(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** % de descuento frente al MSRP. null si no hay referencia. */
export function discountPct(
  basePrice: number,
  msrp: number | null,
): number | null {
  if (msrp == null || msrp <= 0 || basePrice >= msrp) return null;
  return Math.round((1 - basePrice / msrp) * 100);
}

/** IVA colombiano 19% sobre (subtotal + envío), igual que el checkout Stitch. */
export const IVA_RATE = 0.19;
/** Flete plano de referencia (RecuperaLogistics). Ajustable por admin a futuro. */
export const FLAT_SHIPPING_COP = 45000;

export function totals(subtotal: number, shipping = FLAT_SHIPPING_COP) {
  const tax = Math.round((subtotal + shipping) * IVA_RATE);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}

const PACKAGING: Record<string, string> = {
  original: 'Original',
  damaged: 'Dañada',
  no_box: 'Sin caja',
};

const PRODUCT_STATE: Record<string, string> = {
  intact: 'Intacto',
  functional: 'Funcional',
  for_parts: 'Para repuestos',
};

export const packagingLabel = (v: string) => PACKAGING[v] ?? v;
export const productStateLabel = (v: string) => PRODUCT_STATE[v] ?? v;

const ORDER_STATUS: Record<string, string> = {
  pending_payment: 'Pendiente de pago',
  paid: 'Pagado',
  preparing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  returned: 'Devuelto',
};

const SHIPMENT_STATUS: Record<string, string> = {
  pending: 'Pendiente',
  picked_up: 'Recogido',
  in_transit: 'En tránsito',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
  failed: 'Fallido',
  returned: 'Devuelto',
};

export const orderStatusLabel = (v: string) => ORDER_STATUS[v] ?? v;
export const shipmentStatusLabel = (v: string) => SHIPMENT_STATUS[v] ?? v;
