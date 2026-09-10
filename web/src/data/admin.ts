import { requireSupabase } from '../lib/supabase';
import { getDb, isDemo, saveDb, type DemoDb } from '../demo/demo';

const rid = () => crypto.randomUUID();

function demoLots(db: DemoDb) {
  return (db.lots as any[]).map((l) => ({
    id: l.id,
    sku: l.sku,
    title: l.title,
    status: l.status,
    stock_quantity: l.stock_quantity,
    base_price: l.base_price,
    companies: { name: l.companies?.name ?? '' },
  }));
}

function demoOrderItems(db: DemoDb) {
  const items: any[] = [];
  for (const o of db.orders as any[]) {
    if (['cancelled', 'returned'].includes(o.status)) continue;
    for (const i of o.order_items ?? []) {
      items.push({ ...i, order: o });
    }
  }
  return items;
}

/* Lecturas agregadas (vistas con security_invoker: respetan RLS del rol). */
export async function fetchInventorySummary() {
  if (isDemo()) {
    const db = getDb();
    return (db.lots as any[]).map((l) => ({
      id: l.id,
      sku: l.sku,
      title: l.title,
      status: l.status,
      stock_quantity: l.stock_quantity,
      base_price: l.base_price,
      stock_value: l.stock_quantity * Number(l.base_price),
      unit_count: l.unit_count,
      total_weight_kg: l.total_weight_kg,
      warehouse_code: l.warehouses?.code ?? '',
      warehouse_city: l.warehouses?.city ?? '',
      company_name: l.companies?.name ?? '',
      movements_count: (db.movements as any[]).filter((m) => m.lot_id === l.id).length,
    }));
  }
  const { data, error } = await requireSupabase()
    .from('v_inventory_summary')
    .select('*')
    .order('stock_value', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCompanyRecovery() {
  if (isDemo()) {
    const db = getDb();
    return (db.companies as any[]).map((c) => {
      const lots = (db.lots as any[]).filter((l) => l.company_id === c.id);
      const lotIds = new Set(lots.map((l) => l.id));
      const items = demoOrderItems(db).filter((i) => lotIds.has(i.lots?.id));
      return {
        company_id: c.id,
        company_name: c.name,
        is_verified: c.is_verified,
        packages_received: (db.packages as any[]).filter((p) => p.company_id === c.id).length,
        lots_published: lots.filter((l) => l.status === 'published').length,
        revenue_recovered: items.reduce((a, i) => a + Number(i.line_total), 0),
        lots_sold: items.reduce((a, i) => a + i.quantity, 0),
      };
    });
  }
  const { data, error } = await requireSupabase()
    .from('v_company_recovery')
    .select('*')
    .order('revenue_recovered', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchBestSellers() {
  if (isDemo()) {
    const db = getDb();
    const byLot = new Map<string, any>();
    for (const i of demoOrderItems(db)) {
      const id = i.lots?.id;
      if (!id) continue;
      const e = byLot.get(id) ?? {
        id,
        sku: i.lots.sku,
        title: i.lots.title,
        base_price: 0,
        units_sold: 0,
        revenue: 0,
        orders_count: new Set<string>(),
      };
      const lot = (db.lots as any[]).find((l) => l.id === id);
      e.base_price = lot ? Number(lot.base_price) : 0;
      e.units_sold += i.quantity;
      e.revenue += Number(i.line_total);
      e.orders_count.add(i.order.id);
      byLot.set(id, e);
    }
    return [...byLot.values()]
      .map((e) => ({ ...e, orders_count: e.orders_count.size }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }
  const { data, error } = await requireSupabase()
    .from('v_best_selling_lots')
    .select('*')
    .limit(10);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchCounts() {
  if (isDemo()) {
    const db = getDb();
    const tally = (rows: any[], key: string) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r[key]] = (m[r[key]] ?? 0) + 1;
      return m;
    };
    return {
      lots: tally(db.lots as any[], 'status'),
      orders: tally(db.orders as any[], 'status'),
      packages: tally(db.packages as any[], 'status'),
      openTickets: (db.tickets as any[]).filter((t) => t.status !== 'closed').length,
    };
  }
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
  if (isDemo()) return demoLots(getDb());
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
  if (isDemo()) {
    const db = getDb();
    const { category_ids, ...row } = input as any;
    const cats = (db.categories as any[]).filter((c) => category_ids.includes(c.id));
    if (id) {
      const i = (db.lots as any[]).findIndex((l) => l.id === id);
      if (i < 0) throw new Error('Lote no encontrado');
      const prev = (db.lots as any[])[i];
      (db.lots as any[])[i] = {
        ...prev,
        ...row,
        lot_categories: cats.map((c) => ({ categories: c })),
      };
      saveDb(db);
      return id;
    }
    const seq = 500 + (db.lots as any[]).length;
    const lotId = rid();
    const company = (db.companies as any[]).find((c) => c.id === row.company_id);
    const warehouse = (db.warehouses as any[]).find((w) => w.id === row.warehouse_id);
    (db.lots as any[]).unshift({
      id: lotId,
      sku: `RP-${99000 + seq}`,
      published_at: row.status === 'published' ? new Date().toISOString() : null,
      lot_categories: cats.map((c) => ({ categories: c })),
      lot_images: [],
      reviews: [],
      warehouses: warehouse ? { code: warehouse.code, name: warehouse.name, city: warehouse.city } : null,
      brands: null,
      companies: company ? { name: company.name, is_verified: company.is_verified } : null,
      ...row,
    });
    saveDb(db);
    return lotId;
  }
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
  if (isDemo()) {
    const db = getDb();
    const used = (db.orders as any[]).some((o) =>
      (o.order_items ?? []).some((i: any) => i.lots?.id === id),
    );
    if (used) throw new Error('No se puede eliminar: el lote tiene ventas.');
    db.lots = (db.lots as any[]).filter((l) => l.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('lots').delete().eq('id', id);
  if (error) throw error;
}

/** Sube foto al bucket lot-images y la registra. Valida tipo y 5 MB. */
export async function uploadLotImage(lotId: string, file: File, makePrimary: boolean) {
  const okTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!okTypes.includes(file.type)) throw new Error('Solo JPG, PNG o WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Máximo 5 MB por foto.');
  if (isDemo()) {
    // En demo no hay Storage: se registra marcador (muestra placeholder).
    const db = getDb();
    const lot = (db.lots as any[]).find((l) => l.id === lotId);
    if (!lot) throw new Error('Lote no encontrado');
    if (makePrimary) {
      for (const im of lot.lot_images ?? []) im.is_primary = false;
    }
    lot.lot_images = [...(lot.lot_images ?? []), { id: rid(), storage_path: '', is_primary: makePrimary }];
    saveDb(db);
    return;
  }
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
  if (isDemo()) {
    const db = getDb();
    for (const lot of db.lots as any[]) {
      lot.lot_images = (lot.lot_images ?? []).filter((im: any) => im.id !== id);
    }
    saveDb(db);
    return;
  }
  const sb = requireSupabase();
  await sb.storage.from('lot-images').remove([path]);
  const { error } = await sb.from('lot_images').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLotAdmin(id: string) {
  if (isDemo()) {
    const db = getDb();
    const lot = (db.lots as any[]).find((l) => l.id === id);
    if (!lot) throw new Error('Lote no encontrado');
    return {
      ...lot,
      lot_categories: (lot.lot_categories ?? []).map((lc: any) => ({
        category_id: lc.categories?.id,
      })),
      lot_price_tiers: (db.tiers as any[]).filter((t) => t.lot_id === id),
    };
  }
  const { data, error } = await requireSupabase()
    .from('lots')
    .select('*, lot_categories (category_id), lot_images (id, storage_path, is_primary), lot_price_tiers (id, min_quantity, unit_price)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function saveTier(lotId: string, minQty: number, price: number) {
  if (isDemo()) {
    const db = getDb();
    const existing = (db.tiers as any[]).find(
      (t) => t.lot_id === lotId && t.min_quantity === minQty,
    );
    if (existing) existing.unit_price = price;
    else (db.tiers as any[]).push({ id: rid(), lot_id: lotId, min_quantity: minQty, unit_price: price });
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase()
    .from('lot_price_tiers')
    .upsert({ lot_id: lotId, min_quantity: minQty, unit_price: price }, { onConflict: 'lot_id,min_quantity' });
  if (error) throw error;
}

export async function deleteTier(id: string) {
  if (isDemo()) {
    const db = getDb();
    db.tiers = (db.tiers as any[]).filter((t) => t.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('lot_price_tiers').delete().eq('id', id);
  if (error) throw error;
}

/* Inventario y paquetes. */
export async function fetchMovements(lotId?: string) {
  if (isDemo()) {
    const all = [...(getDb().movements as any[])].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );
    return lotId ? all.filter((m) => m.lot_id === lotId) : all.slice(0, 100);
  }
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
  if (isDemo()) {
    const db = getDb();
    const lot = (db.lots as any[]).find((l) => l.id === input.lot_id);
    if (!lot) throw new Error('Lote no encontrado');
    const delta =
      input.movement_type === 'inbound' || input.movement_type === 'return'
        ? input.quantity
        : -input.quantity;
    if (lot.stock_quantity + delta < 0) throw new Error('Stock insuficiente para ese movimiento.');
    lot.stock_quantity += delta;
    (db.movements as any[]).unshift({
      id: rid(),
      created_at: new Date().toISOString(),
      lots: { sku: lot.sku, title: lot.title },
      ...input,
    });
    saveDb(db);
    return;
  }
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
  if (isDemo()) {
    return [...(getDb().packages as any[])].sort((a, b) =>
      String(b.received_at).localeCompare(String(a.received_at)),
    );
  }
  const { data, error } = await requireSupabase()
    .from('packages')
    .select('id, received_at, origin, total_units, total_weight_kg, status, companies (name)')
    .order('received_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function savePackage(id: string | null, input: any) {
  if (isDemo()) {
    const db = getDb();
    if (id) {
      const i = (db.packages as any[]).findIndex((p) => p.id === id);
      if (i >= 0) (db.packages as any[])[i] = { ...(db.packages as any[])[i], ...input };
      saveDb(db);
      return id;
    }
    const company = (db.companies as any[]).find((c) => c.id === input.company_id);
    const nid = rid();
    (db.packages as any[]).unshift({
      id: nid,
      received_at: new Date().toISOString(),
      companies: { name: company?.name ?? '' },
      ...input,
    });
    saveDb(db);
    return nid;
  }
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
  if (isDemo()) {
    const db = getDb();
    return [...(db.orders as any[])]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: o.total,
        created_at: o.created_at,
        ship_city: o.ship_city,
        profiles: { first_name: 'Demo', last_name: 'Usuario' },
      }));
  }
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('id, order_number, status, total, created_at, ship_city, profiles!orders_buyer_id_fkey (first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function updateOrderStatus(id: string, status: string) {
  if (isDemo()) {
    const db = getDb();
    const o = (db.orders as any[]).find((x) => x.id === id);
    if (!o) throw new Error('Pedido no encontrado');
    o.status = status;
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function saveShipment(
  orderId: string,
  input: { carrier: string; tracking_number: string | null; status: string },
  existingId?: string,
) {
  if (isDemo()) {
    const db = getDb();
    if (existingId) {
      const s = (db.shipments as any[]).find((x) => x.id === existingId);
      if (s) Object.assign(s, input);
      saveDb(db);
      return existingId;
    }
    const nid = rid();
    (db.shipments as any[]).push({
      id: nid,
      order_id: orderId,
      shipped_at: null,
      estimated_at: null,
      delivered_at: null,
      shipment_events: [],
      ...input,
    });
    saveDb(db);
    return nid;
  }
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
  if (isDemo()) {
    const db = getDb();
    const s = (db.shipments as any[]).find((x) => x.id === shipmentId);
    if (!s) throw new Error('Despacho no encontrado');
    s.shipment_events = [
      ...(s.shipment_events ?? []),
      { status, location_text: location || null, event_at: new Date().toISOString() },
    ];
    s.status = status;
    saveDb(db);
    return;
  }
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
  if (isDemo()) return [...(getDb().companies as any[])];
  const { data, error } = await requireSupabase()
    .from('companies')
    .select('id, name, tax_id, verification_code, is_verified, city, contact_email')
    .order('name');
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function saveCompany(id: string | null, input: any) {
  if (isDemo()) {
    const db = getDb();
    if (id) {
      const i = (db.companies as any[]).findIndex((c) => c.id === id);
      if (i >= 0) (db.companies as any[])[i] = { ...(db.companies as any[])[i], ...input };
      saveDb(db);
      return id;
    }
    const nid = rid();
    (db.companies as any[]).push({ id: nid, country: 'Colombia', ...input });
    saveDb(db);
    return nid;
  }
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
  if (isDemo()) return [...(getDb().users as any[])];
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, first_name, last_name, phone, is_active, created_at, roles!inner (code, name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchRoles() {
  if (isDemo()) {
    return [
      { id: 'r1', code: 'customer', name: 'Cliente particular' },
      { id: 'r2', code: 'reseller', name: 'Revendedor' },
      { id: 'r3', code: 'company', name: 'Empresa proveedora' },
      { id: 'r4', code: 'admin', name: 'Administrador' },
    ];
  }
  const { data, error } = await requireSupabase().from('roles').select('id, code, name').order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; code: string; name: string }[];
}

export async function updateUser(id: string, input: { role_id?: string; is_active?: boolean }) {
  if (isDemo()) {
    const db = getDb();
    const u = (db.users as any[]).find((x) => x.id === id);
    if (!u) throw new Error('Usuario no encontrado');
    if (input.role_id) {
      const byId: Record<string, { code: string; name: string }> = {
        r1: { code: 'customer', name: 'Cliente particular' },
        r2: { code: 'reseller', name: 'Revendedor' },
        r3: { code: 'company', name: 'Empresa proveedora' },
        r4: { code: 'admin', name: 'Administrador' },
      };
      u.roles = byId[input.role_id] ?? { code: input.role_id, name: input.role_id };
    }
    if (input.is_active !== undefined) u.is_active = input.is_active;
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from('profiles').update(input).eq('id', id);
  if (error) throw error;
}

/* Catálogos genéricos (categorías, marcas, promociones, faqs, pagos, bodegas). */
const DEMO_TABLES: Record<string, string> = {
  categories: 'categories',
  brands: 'brands',
  promotions: 'promotions',
  faqs: 'faqs',
  payment_methods: 'payments',
  warehouses: 'warehouses',
  lots: 'lots',
  packages: 'packages',
  companies: 'companies',
};

export async function fetchTable(table: string, orderBy = 'name') {
  if (isDemo()) {
    const key = DEMO_TABLES[table];
    if (!key) throw new Error(`Tabla demo no soportada: ${table}`);
    const rows = [...((getDb() as any)[key] as any[])];
    rows.sort((a, b) => String(a[orderBy] ?? '').localeCompare(String(b[orderBy] ?? '')));
    return rows;
  }
  const { data, error } = await requireSupabase().from(table).select('*').order(orderBy);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function saveRow(table: string, id: string | null, input: any) {
  if (isDemo()) {
    const key = DEMO_TABLES[table];
    if (!key) throw new Error(`Tabla demo no soportada: ${table}`);
    const db = getDb();
    const arr = (db as any)[key] as any[];
    if (id) {
      const i = arr.findIndex((r) => r.id === id);
      if (i >= 0) arr[i] = { ...arr[i], ...input };
      saveDb(db);
      return id;
    }
    const nid = rid();
    arr.push({ id: nid, ...input });
    saveDb(db);
    return nid;
  }
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
  if (isDemo()) {
    const key = DEMO_TABLES[table];
    if (!key) throw new Error(`Tabla demo no soportada: ${table}`);
    const db = getDb();
    (db as any)[key] = ((db as any)[key] as any[]).filter((r) => r.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase().from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function linkPromotionLot(promotionId: string, lotId: string) {
  if (isDemo()) {
    const db = getDb();
    const exists = (db.promotionLots as any[]).some(
      (p) => p.promotion_id === promotionId && p.lot_id === lotId,
    );
    if (!exists) (db.promotionLots as any[]).push({ promotion_id: promotionId, lot_id: lotId });
    saveDb(db);
    return;
  }
  const { error } = await requireSupabase()
    .from('promotion_lots')
    .insert({ promotion_id: promotionId, lot_id: lotId });
  if (error) throw error;
}
