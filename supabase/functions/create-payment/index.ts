// RecuperaPack — create-payment (Fase 2)
// Crea una preferencia de MercadoPago para un pedido en pending_payment.
// Auth: JWT de usuario (verify_jwt=true). Sin MP_ACCESS_TOKEN → 501.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  if (!MP_TOKEN) {
    // Pasarela no configurada: el frontend deja el pedido pendiente de pago.
    return Response.json({ error: 'gateway_not_configured' }, { status: 501 });
  }
  const FRONTEND_URL = (Deno.env.get('FRONTEND_URL') ?? '').replace(/\/$/, '');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!FRONTEND_URL || !SUPABASE_URL || !SERVICE_KEY) {
    return Response.json({ error: 'function_misconfigured' }, { status: 500 });
  }

  let orderId = '';
  try {
    orderId = (await req.json() as { order_id?: unknown }).order_id as string;
  } catch {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  // Usuario dueño del pedido (vía su JWT).
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, order_number, total, currency, status, buyer_id')
    .eq('id', orderId)
    .single();
  if (orderError || !order) return Response.json({ error: 'order_not_found' }, { status: 404 });
  if ((order as { buyer_id: string }).buyer_id !== user.id) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  if ((order as { status: string }).status !== 'pending_payment') {
    return Response.json({ error: 'order_not_payable' }, { status: 409 });
  }

  const o = order as {
    id: string;
    order_number: string;
    total: number;
    currency: string;
  };
  const returnUrl = `${FRONTEND_URL}/pedidos/${o.id}`;
  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{
        title: `Pedido ${o.order_number} · RecuperaPack`,
        quantity: 1,
        unit_price: Number(o.total),
        currency_id: o.currency === 'USD' ? 'USD' : 'CLP',
      }],
      back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
      auto_return: 'approved',
      notification_url: `${SUPABASE_URL}/functions/v1/payment-webhook`,
      external_reference: o.id,
      statement_descriptor: 'RECUPERAPACK',
    }),
  });
  if (!mpRes.ok) {
    return Response.json({ error: 'gateway_error' }, { status: 502 });
  }
  const pref = await mpRes.json() as { id?: string; init_point?: string };
  if (!pref.id || !pref.init_point) {
    return Response.json({ error: 'gateway_error' }, { status: 502 });
  }

  const { error: payError } = await admin.from('payments').insert({
    order_id: o.id,
    provider: 'mercadopago',
    external_id: String(pref.id),
    status: 'pending',
    amount: o.total,
    currency: o.currency,
    raw: { preference_id: pref.id },
  });
  if (payError) return Response.json({ error: 'db_error' }, { status: 500 });

  return Response.json({ init_point: pref.init_point, external_id: String(pref.id) });
});
