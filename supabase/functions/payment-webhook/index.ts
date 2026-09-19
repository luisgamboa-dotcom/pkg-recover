// RecuperaPack — payment-webhook (Fase 2)
// Recibe eventos de MercadoPago (?id= / body.data.id), valida la firma
// x-signature, consulta el pago y confirma el pedido (idempotente).
// Público (verify_jwt=false): la autenticidad la da la firma de MercadoPago.
import { createClient } from 'jsr:@supabase/supabase-js@2';

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function mapStatus(mp: string): string | null {
  if (mp === 'approved') return 'approved';
  if (mp === 'rejected') return 'rejected';
  if (mp === 'cancelled') return 'cancelled';
  if (mp === 'refunded' || mp === 'charged_back') return 'refunded';
  if (mp === 'in_process' || mp === 'pending' || mp === 'authorized') return 'pending';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const SECRET = Deno.env.get('MP_WEBHOOK_SECRET');
  const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SECRET || !MP_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
    return Response.json({ error: 'webhook_not_configured' }, { status: 500 });
  }

  const url = new URL(req.url);
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const dataId =
    url.searchParams.get('id') ??
    (body as { data?: { id?: unknown } } | null)?.data?.id;
  const topic = url.searchParams.get('topic') ?? (body as { type?: unknown } | null)?.type;
  if (!dataId || (topic !== 'payment' && topic !== undefined && topic !== null)) {
    // Pings de prueba u otros tópicos: acuse sin procesar.
    if (!dataId) return Response.json({ received: true });
  }
  const paymentId = String(dataId);

  // Firma MercadoPago: v1 = HMAC_SHA256("id:{id};request-id:{rid};ts:{ts};").
  const sigHeader = req.headers.get('x-signature') ?? '';
  const ts = (sigHeader.match(/(?:^|;)ts=([^;,]+)/) ?? [])[1] ?? '';
  const v1 = (sigHeader.match(/(?:^|;)v1=([^;,]+)/) ?? [])[1] ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = await hmacHex(SECRET, manifest);
  if (!v1 || v1.toLowerCase() !== expected.toLowerCase()) {
    return Response.json({ error: 'bad_signature' }, { status: 401 });
  }

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!mpRes.ok) return Response.json({ error: 'gateway_error' }, { status: 502 });
  const payment = await mpRes.json() as {
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
  };
  const mapped = mapStatus(String(payment.status ?? ''));
  if (!mapped) return Response.json({ received: true });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row } = await admin
    .from('payments')
    .select('id, order_id, status')
    .eq('external_id', paymentId)
    .maybeSingle();
  const r = row as { id: string; order_id: string; status: string } | null;
  if (!r) return Response.json({ error: 'unknown_payment' }, { status: 404 });
  if (r.status === mapped) return Response.json({ received: true }); // idempotente

  await admin.from('payments').update({
    status: mapped,
    raw: payment as unknown as Record<string, unknown>,
  }).eq('id', r.id);

  if (mapped === 'approved') {
    // Solo avanza desde pendiente (no pisa cancelaciones/devoluciones manuales).
    const { data: order } = await admin
      .from('orders')
      .select('id, status')
      .eq('id', r.order_id)
      .single();
    const o = order as { id: string; status: string } | null;
    if (o && o.status === 'pending_payment') {
      await admin.from('orders').update({ status: 'paid' }).eq('id', o.id);
      // El trigger trg_orders_notify avisa al comprador automáticamente.
    }
  }
  return Response.json({ received: true });
});
