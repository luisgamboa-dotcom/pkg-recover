import { requireSupabase } from '../lib/supabase';

/* Lecturas agregadas (vistas con security_invoker: respetan RLS del rol). */
export async function fetchInventorySummary() {
  const { data, error } = await requireSupabase()
    .from('v_inventory_summary')
    .select('*')
    .order('stock_value', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanyRecovery() {
  const { data, error } = await requireSupabase()
    .from('v_company_recovery')
    .select('*')
    .order('revenue_recovered', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchBestSellers() {
  const { data, error } = await requireSupabase()
    .from('v_best_selling_lots')
    .select('*')
    .limit(10);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCounts() {
  const sb = requireSupabase();
  const [lots, orders, packages, tickets] = await Promise.all([
    sb.from('lots').select('id, status', { count: 'exact' }),
    sb.from('orders').select('id, status', { count: 'exact' }),
    sb.from('packages').select('id, status', { count: 'exact' }),
    sb.from('support_tickets').select('id, status', { count: 'exact' }).neq('status', 'closed'),
  ]);
  const tally = (rows: any[] | null, key: string) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r[key]] = (m[r[key]] ?? 0) + 1;
    return m;
  };
  return {
    lots: tally(lots.data, 'status'),
    orders: tally(orders.data, 'status'),
    packages: tally(packages.data, 'status'),
    openTickets: tickets.count ?? 0,
  };
}

/* Lotes (admin ve todos los estados). */
export async function fetchAllLots() {
  const { data, error } = await requireSupabase()
    .from('lots')
    .select('id, sku, title, status, stock_quantity, base_price, is_featured, companies (name)')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export interface LotInput {
  title: string;
  description: string;
  company_id: string | null;
  package_id: string | null;
  warehouse_id: string | null;
  warehouse_zone: string;
  brand_id: string | null;
  packaging_state: string;
  product_state: string;
  is_verified: boolean;
  unit_count: number;
  total_weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  base_price: number;
  msrp_reference: number | null;
  currency: string;
  stock_quantity: number;
  status: string;
  is_featured: boolean;
  circularity_percent: number | null;
  waste_avoided_kg: number | null;
  category_ids: string[];
}

export async function saveLot(id: string | null, input: LotInput): Promise<string> {
  const sb = requireSupabase();
  const { category_ids, ...row } = input;
  let lotId = id;
  if (id) {
    const { error } = await sb.from('lots').update(row).eq('id', id);
    if (error) throw error;
    await sb.from('lot_categories').delete().eq('lot_id', id);
  } else {
    const { data, error } = await sb.from('lots').insert(row).select('id').single();
    if (error || !data) throw error ?? new Error('No se creó el lote');
    lotId = (data as { id: string }).id;
  }
  if (category_ids.length > 0) {
    const { error } = await sb
      .from('lot_categories')
      .insert(category_ids.map((category_id) => ({ lot_id: lotId, category_id })));
    if (error) throw error;
  }
  return lotId as string;
}

export async function deleteLot(id: string) {
  const { error } = await requireSupabase().from('lots').delete().eq('id', id);
  if (error) throw error;
}

/** Sube foto al bucket lot-images y la registra. Valida tipo y 5 MB. */
export async function uploadLotImage(lotId: string, file: File, makePrimary: boolean) {
  const okTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!okTypes.includes(file.type)) throw new Error('Solo JPG, PNG o WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Máximo 5 MB por foto.');
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(0, 80);
  const path = `lots/${lotId}/${Date.now()}-${safe}`;
  const sb = requireSupabase();
  const { error: upError } = await sb.storage.from('lot-images').upload(path, file);
  if (upError) throw upError;
  if (makePrimary) {
    await sb.from('lot_images').update({ is_primary: false }).eq('lot_id', lotId);
  }
  const { error: rowError } = await sb
    .from('lot_images')
    .insert({ lot_id: lotId, storage_path: path, is_primary: makePrimary });
  if (rowError) throw rowError;
}

export async function deleteLotImage(id: string, path: string) {
  const sb = requireSupabase();
  await sb.storage.from('lot-images').remove([path]);
  const { error } = await sb.from('lot_images').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLotAdmin(id: string) {
  const { data, error } = await requireSupabase()
    .from('lots')
    .select('*, lot_categories (category_id), lot_images (id, storage_path, is_primary), lot_price_tiers (id, min_quantity, unit_price)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function saveTier(lotId: string, minQty: number, price: number) {
  const { error } = await requireSupabase()
    .from('lot_price_tiers')
    .upsert({ lot_id: lotId, min_quantity: minQty, unit_price: price }, { onConflict: 'lot_id,min_quantity' });
  if (error) throw error;
}

export async function deleteTier(id: string) {
  const { error } = await requireSupabase().from('lot_price_tiers').delete().eq('id', id);
  if (error) throw error;
}

/* Inventario y paquetes. */
export async function fetchMovements(lotId?: string) {
  let q = requireSupabase()
    .from('inventory_movements')
    .select('id, movement_type, quantity, reference, notes, created_at, lots (sku, title)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (lotId) q = q.eq('lot_id', lotId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function addMovement(input: {
  lot_id: string;
  movement_type: string;
  quantity: number;
  reference: string;
  notes: string;
}) {
  const sb = requireSupabase();
  const { error } = await sb.from('inventory_movements').insert(input);
  if (error) throw error;
  // Ajusta stock del lote según el tipo (la venta la descuenta el trigger).
  const delta =
    input.movement_type === 'inbound' || input.movement_type === 'return'
      ? input.quantity
      : -input.quantity;
  const { data: lot } = await sb
    .from('lots')
    .select('stock_quantity')
    .eq('id', input.lot_id)
    .single();
  const current = (lot as any)?.stock_quantity ?? 0;
  if (current + delta < 0) throw new Error('Stock insuficiente para ese movimiento.');
  const { error: stockError } = await sb
    .from('lots')
    .update({ stock_quantity: current + delta })
    .eq('id', input.lot_id);
  if (stockError) throw stockError;
}

export async function fetchPackages() {
  const { data, error } = await requireSupabase()
    .from('packages')
    .select('id, received_at, origin, total_units, total_weight_kg, status, companies (name), reception_methods (name)')
    .order('received_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function savePackage(id: string | null, input: any) {
  const sb = requireSupabase();
  if (id) {
    const { error } = await sb.from('packages').update(input).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from('packages').insert(input).select('id').single();
  if (error || !data) throw error ?? new Error('No se creó el paquete');
  return (data as { id: string }).id;
}

/* Pedidos (admin): todos + cambio de estado + despacho. */
export async function fetchAllOrders() {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('id, order_number, status, total, created_at, ship_city, payment_methods (name), profiles!orders_buyer_id_fkey (first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function updateOrderStatus(id: string, status: string) {
  const { error } = await requireSupabase().from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function saveShipment(
  orderId: string,
  input: { carrier: string; tracking_number: string | null; status: string },
  existingId?: string,
) {
  const sb = requireSupabase();
  if (existingId) {
    const { error } = await sb.from('shipments').update(input).eq('id', existingId);
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await sb
    .from('shipments')
    .insert({ order_id: orderId, ...input })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('No se creó el despacho');
  return (data as { id: string }).id;
}

export async function addShipmentEvent(shipmentId: string, status: string, location: string) {
  const sb = requireSupabase();
  const { error } = await sb.from('shipment_events').insert({
    shipment_id: shipmentId,
    status,
    location_text: location || null,
  });
  if (error) throw error;
  await sb.from('shipments').update({ status }).eq('id', shipmentId);
}

/* Empresas y usuarios. */
export async function fetchCompanies() {
  const { data, error } = await requireSupabase()
    .from('companies')
    .select('id, name, tax_id, verification_code, is_verified, city, contact_email')
    .order('name');
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function saveCompany(id: string | null, input: any) {
  const sb = requireSupabase();
  if (id) {
    const { error } = await sb.from('companies').update(input).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from('companies').insert(input).select('id').single();
  if (error || !data) throw error ?? new Error('No se creó la empresa');
  return (data as { id: string }).id;
}

export async function fetchUsers() {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, first_name, last_name, phone, is_active, created_at, roles!inner (code, name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchRoles() {
  const { data, error } = await requireSupabase().from('roles').select('id, code, name').order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; code: string; name: string }[];
}

export async function updateUser(id: string, input: { role_id?: string; is_active?: boolean }) {
  const { error } = await requireSupabase().from('profiles').update(input).eq('id', id);
  if (error) throw error;
}

/* Catálogos genéricos (categorías, marcas, promociones, faqs, pagos, bodegas). */
export async function fetchTable(table: string, orderBy = 'name') {
  const { data, error } = await requireSupabase().from(table).select('*').order(orderBy);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function saveRow(table: string, id: string | null, input: any) {
  const sb = requireSupabase();
  if (id) {
    const { error } = await sb.from(table).update(input).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from(table).insert(input).select('id').single();
  if (error || !data) throw error ?? new Error('No se guardó');
  return (data as { id: string }).id;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await requireSupabase().from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function linkPromotionLot(promotionId: string, lotId: string) {
  const { error } = await requireSupabase()
    .from('promotion_lots')
    .insert({ promotion_id: promotionId, lot_id: lotId });
  if (error) throw error;
}
