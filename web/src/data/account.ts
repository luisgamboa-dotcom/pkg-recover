import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { isUuid } from '../lib/validation';
import { createDemoOrder, getDb, isDemo, saveDb } from '../demo/demo';

export interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  lot: { id: string; sku: string; title: string } | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  total: number;
  currency: string;
  carrier: string | null;
  created_at: string;
  payment_method: { name: string } | null;
  ship_recipient_name: string;
  ship_city: string;
  ship_address_line: string;
  items: OrderItem[];
}

export interface Shipment {
  id: string;
  carrier: string;
  tracking_number: string | null;
  status: string;
  shipped_at: string | null;
  estimated_at: string | null;
  delivered_at: string | null;
  events: { status: string; location_text: string | null; event_at: string }[];
}

export interface Address {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  city: string;
  address_line: string;
  delivery_notes: string | null;
  is_default: boolean;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

const ORDER_SELECT = `
  id, order_number, status, subtotal, shipping_cost, tax_amount, total,
  currency, carrier, created_at,
  ship_recipient_name, ship_city, ship_address_line,
  payment_methods (name),
  order_items (id, quantity, unit_price, line_total, lots (id, sku, title))
`;

export function toOrder(r: any): Order {
  return {
    id: r.id,
    order_number: r.order_number,
    status: r.status,
    subtotal: Number(r.subtotal),
    shipping_cost: Number(r.shipping_cost),
    tax_amount: Number(r.tax_amount),
    total: Number(r.total),
    currency: r.currency,
    carrier: r.carrier,
    created_at: r.created_at,
    payment_method: r.payment_methods ?? null,
    ship_recipient_name: r.ship_recipient_name,
    ship_city: r.ship_city,
    ship_address_line: r.ship_address_line,
    items: (r.order_items ?? []).map((i: any) => ({
      id: i.id,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
      lot: i.lots
        ? { id: i.lots.id, sku: i.lots.sku, title: i.lots.title }
        : null,
    })),
  };
}

export function useMyOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      setOrders(
        (getDb().orders as any[])
          .filter((o) => o.buyer_id === userId)
          .map(toOrder),
      );
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    requireSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setOrders(((data ?? []) as any[]).map(toOrder));
        setLoading(false);
      });
  }, [userId]);

  return { orders, loading, configured: isSupabaseConfigured };
}

export function useOrder(orderId: string | undefined, userId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId || !userId) {
      setLoading(false);
      return;
    }
    // El :id viene de la URL: exige UUID antes de consultar.
    if (!isUuid(orderId)) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      const db = getDb();
      const found = (db.orders as any[]).find((o) => o.id === orderId);
      if (found) {
        setOrder(toOrder(found));
        const ship = (db.shipments as any[]).find((s) => s.order_id === orderId);
        if (ship) {
          setShipment({
            id: ship.id,
            carrier: ship.carrier,
            tracking_number: ship.tracking_number,
            status: ship.status,
            shipped_at: ship.shipped_at,
            estimated_at: ship.estimated_at,
            delivered_at: ship.delivered_at,
            events: [...(ship.shipment_events ?? [])].sort((a: any, b: any) =>
              String(a.event_at).localeCompare(String(b.event_at)),
            ),
          });
        }
      }
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = requireSupabase();
    sb.from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .single()
      .then(async ({ data, error }) => {
        if (!error && data) {
          setOrder(toOrder(data));
          const { data: ship } = await sb
            .from('shipments')
            .select(
              'id, carrier, tracking_number, status, shipped_at, estimated_at, delivered_at, shipment_events (status, location_text, event_at)',
            )
            .eq('order_id', orderId)
            .maybeSingle();
          if (ship) {
            const s = ship as any;
            setShipment({
              id: s.id,
              carrier: s.carrier,
              tracking_number: s.tracking_number,
              status: s.status,
              shipped_at: s.shipped_at,
              estimated_at: s.estimated_at,
              delivered_at: s.delivered_at,
              events: (s.shipment_events ?? []).sort((a: any, b: any) =>
                String(a.event_at).localeCompare(String(b.event_at)),
              ),
            });
          }
        }
        setLoading(false);
      });
  }, [orderId, userId]);

  return { order, shipment, loading, configured: isSupabaseConfigured };
}

export interface NewOrderInput {
  buyerId: string;
  paymentMethodId: string;
  shippingCost: number;
  taxAmount: number;
  ship: {
    recipient: string;
    phone: string;
    city: string;
    address: string;
    notes: string;
    addressId: string | null;
  };
  items: { lotId: string; qty: number; unitPrice: number }[];
}

/** Crea pedido + detalle. Los triggers calculan totales y descuentan stock. */
export async function createOrder(input: NewOrderInput): Promise<string> {
  if (isDemo()) {
    const db = getDb();
    const method =
      db.payments.find((m: any) => m.id === input.paymentMethodId)?.name ?? 'Demo';
    return createDemoOrder({
      items: input.items,
      shippingCost: input.shippingCost,
      taxAmount: input.taxAmount,
      ship: input.ship,
      paymentName: method,
    });
  }
  const sb = requireSupabase();
  const { data: order, error: orderError } = await sb
    .from('orders')
    .insert({
      buyer_id: input.buyerId,
      status: 'pending_payment',
      shipping_cost: input.shippingCost,
      tax_amount: input.taxAmount,
      currency: 'COP',
      payment_method_id: input.paymentMethodId,
      shipping_address_id: input.ship.addressId,
      ship_recipient_name: input.ship.recipient,
      ship_phone: input.ship.phone,
      ship_city: input.ship.city,
      ship_address_line: input.ship.address,
      ship_notes: input.ship.notes || null,
    })
    .select('id')
    .single();
  if (orderError || !order) throw orderError ?? new Error('No se creó el pedido');

  const { error: itemsError } = await sb.from('order_items').insert(
    input.items.map((i) => ({
      order_id: (order as { id: string }).id,
      lot_id: i.lotId,
      // Defensa en profundidad: cantidad entera >= 1 aunque el UI falle.
      quantity: Math.max(1, Math.floor(Number(i.qty) || 1)),
      unit_price: i.unitPrice,
    })),
  );
  if (itemsError) {
    await sb.from('orders').delete().eq('id', (order as { id: string }).id);
    throw itemsError;
  }
  return (order as { id: string }).id;
}

export function useAddresses(userId: string | undefined) {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      setItems([...(getDb().addresses as Address[])]);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await requireSupabase()
      .from('addresses')
      .select('*')
      .eq('profile_id', userId)
      .order('is_default', { ascending: false });
    setItems((data ?? []) as Address[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

export async function saveAddress(
  userId: string,
  input: Omit<Address, 'id'> & { id?: string },
) {
  if (isDemo()) {
    const db = getDb();
    if (input.is_default) {
      for (const a of db.addresses as any[]) a.is_default = false;
    }
    if (input.id) {
      const i = (db.addresses as any[]).findIndex((a) => a.id === input.id);
      if (i >= 0) db.addresses[i] = { ...db.addresses[i], ...input };
    } else {
      const id = `demo-addr-${Date.now()}`;
      (db.addresses as any[]).push({ ...input, id });
      saveDb(db);
      return id;
    }
    saveDb(db);
    return input.id as string;
  }
  const sb = requireSupabase();
  if (input.is_default) {
    await sb
      .from('addresses')
      .update({ is_default: false })
      .eq('profile_id', userId);
  }
  if (input.id) {
    const { error } = await sb
      .from('addresses')
      .update({
        label: input.label,
        recipient_name: input.recipient_name,
        phone: input.phone,
        city: input.city,
        address_line: input.address_line,
        delivery_notes: input.delivery_notes,
        is_default: input.is_default,
      })
      .eq('id', input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await sb
    .from('addresses')
    .insert({
      profile_id: userId,
      label: input.label,
      recipient_name: input.recipient_name,
      phone: input.phone,
      city: input.city,
      address_line: input.address_line,
      delivery_notes: input.delivery_notes,
      is_default: input.is_default,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteAddress(id: string) {
  if (isDemo()) {
    const db = getDb();
    db.addresses = (db.addresses as any[]).filter((a) => a.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('addresses').delete().eq('id', id);
  if (error) throw error;
}

export function usePaymentMethods() {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  useEffect(() => {
    if (isDemo()) {
      setItems(getDb().payments as PaymentMethod[]);
      return;
    }
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('payment_methods')
      .select('id, code, name, description')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setItems((data ?? []) as PaymentMethod[]));
  }, []);
  return items;
}

export async function updateProfile(
  userId: string,
  input: { firstName: string; lastName: string; phone: string },
) {
  if (isDemo()) {
    const db = getDb();
    db.profile = { first_name: input.firstName, last_name: input.lastName, phone: input.phone };
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase()
    .from('profiles')
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    })
    .eq('id', userId);
  if (error) throw error;
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export function useFaqs() {
  const [items, setItems] = useState<Faq[]>([]);
  useEffect(() => {
    if (isDemo()) {
      setItems(getDb().faqs as Faq[]);
      return;
    }
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('faqs')
      .select('id, category, question, answer')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setItems((data ?? []) as Faq[]));
  }, []);
  return items;
}

export async function createTicket(input: {
  profileId: string;
  orderId: string | null;
  subject: string;
  category: string;
  message: string;
}) {
  if (isDemo()) {
    const db = getDb();
    const id = `demo-ticket-${Date.now()}`;
    db.tickets.unshift({
      id,
      ticket_number: `SUP-${String(db.seq.ticket++).padStart(6, '0')}`,
      profile_id: input.profileId,
      order_id: input.orderId,
      subject: input.subject,
      category: input.category,
      status: 'open',
      created_at: new Date().toISOString(),
    });
    db.ticketMessages.push({
      id: `demo-tmsg-${Date.now()}`,
      ticket_id: id,
      sender_id: input.profileId,
      body: input.message,
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return id;
  }
  const sb = requireSupabase();
  const { data: ticket, error } = await sb
    .from('support_tickets')
    .insert({
      profile_id: input.profileId,
      order_id: input.orderId,
      subject: input.subject,
      category: input.category,
    })
    .select('id')
    .single();
  if (error || !ticket) throw error ?? new Error('No se creó el ticket');
  const { error: msgError } = await sb.from('ticket_messages').insert({
    ticket_id: (ticket as { id: string }).id,
    sender_id: input.profileId,
    body: input.message,
  });
  if (msgError) throw msgError;
  return (ticket as { id: string }).id;
}

export interface Prefs {
  offers: boolean;
  new_lots: boolean;
  order_updates: boolean;
  shipping_updates: boolean;
  availability: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  lot_id: string | null;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (isDemo()) {
      setItems(
        [...(getDb().notifications as Notification[])].sort((a, b) =>
          String(b.created_at).localeCompare(String(a.created_at)),
        ),
      );
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await requireSupabase()
      .from('notifications')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      if (isDemo()) {
        const db = getDb();
        for (const n of db.notifications as any[]) {
          if (n.id === id) n.is_read = true;
        }
        saveDb(db);
      } else {
        await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id);
      }
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    if (isDemo()) {
      const db = getDb();
      for (const n of db.notifications as any[]) n.is_read = true;
      saveDb(db);
      await refresh();
      return;
    }
    await requireSupabase()
      .from('notifications')
      .update({ is_read: true })
      .eq('profile_id', userId)
      .eq('is_read', false);
    await refresh();
  }, [userId, refresh]);

  return { items, loading, refresh, markRead, markAllRead, unread: items.filter((n) => !n.is_read).length };
}

export interface Thread {
  lotId: string;
  lotTitle: string;
  lotSku: string;
  otherName: string;
  lastBody: string;
  lastAt: string;
  unread: number;
}

export async function fetchThreads(userId: string): Promise<Thread[]> {
  if (isDemo()) {
    const db = getDb();
    const mine = (db.messages as any[]).filter(
      (m) => m.sender_id === userId || m.receiver_id === userId,
    );
    const lotName = (id: string) => {
      const l = (db.lots as any[]).find((x) => x.id === id);
      return { title: l?.title ?? 'Lote', sku: l?.sku ?? '' };
    };
    const userName = (id: string) => {
      if (id === userId) return 'Tú';
      const u = (db.users as any[]).find((x) => x.id === id);
      return u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Usuario' : 'Usuario';
    };
    const map = new Map<string, Thread>();
    for (const m of mine.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
      if (!map.has(m.lot_id)) {
        const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
        const info = lotName(m.lot_id);
        map.set(m.lot_id, {
          lotId: m.lot_id,
          lotTitle: info.title,
          lotSku: info.sku,
          otherName: userName(other),
          lastBody: m.body,
          lastAt: m.created_at,
          unread: 0,
        });
      }
      const t = map.get(m.lot_id)!;
      if (m.receiver_id === userId && !m.is_read) t.unread += 1;
    }
    return [...map.values()];
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .select('lot_id, body, created_at, is_read, receiver_id, sender_id, lots (title, sku), sender:profiles!messages_sender_id_fkey (first_name), receiver:profiles!messages_receiver_id_fkey (first_name)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const map = new Map<string, Thread>();
  for (const m of (data ?? []) as any[]) {
    if (!map.has(m.lot_id)) {
      const mine = m.sender_id === userId;
      const other = mine ? m.receiver?.first_name : m.sender?.first_name;
      map.set(m.lot_id, {
        lotId: m.lot_id,
        lotTitle: m.lots?.title ?? 'Lote',
        lotSku: m.lots?.sku ?? '',
        otherName: other ?? 'Usuario',
        lastBody: m.body,
        lastAt: m.created_at,
        unread: 0,
      });
    }
    const t = map.get(m.lot_id)!;
    if (m.receiver_id === userId && !m.is_read) t.unread += 1;
  }
  return [...map.values()];
}

export async function fetchThreadMessages(userId: string, lotId: string) {
  if (isDemo()) {
    const db = getDb();
    const msgs = (db.messages as any[]).filter(
      (m) =>
        m.lot_id === lotId && (m.sender_id === userId || m.receiver_id === userId),
    );
    for (const m of msgs) {
      if (m.receiver_id === userId) m.is_read = true;
    }
    saveDb(db);
    return msgs.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .select('id, body, created_at, sender_id, receiver_id')
    .eq('lot_id', lotId)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at');
  if (error) throw error;
  await sb
    .from('messages')
    .update({ is_read: true })
    .eq('lot_id', lotId)
    .eq('receiver_id', userId);
  return (data ?? []) as any[];
}

export async function sendMessage(lotId: string, senderId: string, receiverId: string, body: string) {
  if (isDemo()) {
    const db = getDb();
    (db.messages as any[]).push({
      id: `demo-msg-${Date.now()}`,
      lot_id: lotId,
      sender_id: senderId,
      receiver_id: receiverId,
      body,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase()
    .from('messages')
    .insert({ lot_id: lotId, sender_id: senderId, receiver_id: receiverId, body });
  if (error) throw error;
}

/** Receptor de consulta por un lote: dueño de la empresa o admin. */
export async function findSellerForLot(lotId: string, excludeId: string): Promise<string> {
  if (isDemo()) {
    const db = getDb();
    const lot = (db.lots as any[]).find((l) => l.id === lotId);
    const members = (db.company_members as any[]).filter(
      (m) => m.company_id === lot?.company_id && m.profile_id !== excludeId,
    );
    if (members.length > 0) return members[0].profile_id as string;
    return '00000000-0000-0000-0000-000000000002';
  }
  const sb = requireSupabase();
  const { data: lot } = await sb.from('lots').select('company_id').eq('id', lotId).single();
  const companyId = (lot as any)?.company_id;
  if (companyId) {
    const { data: members } = await sb
      .from('company_members')
      .select('profile_id, company_role')
      .eq('company_id', companyId)
      .neq('profile_id', excludeId)
      .order('company_role');
    const owner = (members ?? []) as any[];
    if (owner.length > 0) return owner[0].profile_id as string;
  }
  const { data: admins } = await sb
    .from('profiles')
    .select('id, roles!inner (code)')
    .eq('roles.code', 'admin')
    .neq('id', excludeId)
    .limit(1);
  if ((admins ?? []).length === 0) throw new Error('Este lote aún no tiene vendedor asignado.');
  return (admins as any[])[0].id as string;
}

export function usePrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    if (!userId) return;
    if (isDemo()) {
      setPrefs({ ...getDb().prefs });
      return;
    }
    if (!isSupabaseConfigured) return;
    requireSupabase()
      .from('notification_preferences')
      .select('offers, new_lots, order_updates, shipping_updates, availability')
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs(data as Prefs);
      });
  }, [userId]);

  const save = useCallback(
    async (next: Prefs) => {
      if (!userId) return;
      if (isDemo()) {
        const db = getDb();
        db.prefs = { ...next };
        saveDb(db);
        setPrefs(next);
        return;
      }
      const { error } = await requireSupabase()
        .from('notification_preferences')
        .update(next)
        .eq('profile_id', userId);
      if (error) throw error;
      setPrefs(next);
    },
    [userId],
  );

  return { prefs, save };
}
