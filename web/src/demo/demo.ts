/**
 * Modo demo (testeo sin Supabase): sesión local + base de mentiras realista
 * persistida en localStorage. Las filas imitan la forma de PostgREST para
 * reutilizar los mapeadores (toLot/toOrder) sin cambios.
 */

export const DEMO_EMAIL = 'demo@recuperapack.com';
export const DEMO_PASS = 'demo1234';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const OWNER_ID = '00000000-0000-0000-0000-000000000003';

const SESSION_KEY = 'rp-demo-session';
const ROLE_KEY = 'rp-demo-role';
const DB_KEY = 'rp-demo-db-v1';

export type DemoRole = 'customer' | 'reseller' | 'company' | 'admin';

export const ROLE_NAMES: Record<DemoRole, string> = {
  customer: 'Cliente particular',
  reseller: 'Revendedor',
  company: 'Empresa proveedora',
  admin: 'Administrador',
};

export function isDemo(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function demoLogin(email: string, password: string): boolean {
  if (
    email.trim().toLowerCase() !== DEMO_EMAIL ||
    password !== DEMO_PASS
  ) {
    return false;
  }
  try {
    localStorage.setItem(SESSION_KEY, '1');
    if (!localStorage.getItem(ROLE_KEY)) localStorage.setItem(ROLE_KEY, 'admin');
    getDb(); // siembra si es primera vez
  } catch {
    return false;
  }
  return true;
}

export function demoLogout() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

export function getDemoRole(): DemoRole {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    if (r === 'customer' || r === 'reseller' || r === 'company' || r === 'admin') return r;
  } catch {
    /* noop */
  }
  return 'admin';
}

export function setDemoRole(role: DemoRole) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* noop */
  }
}

export function resetDemo() {
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    /* noop */
  }
}

/** UUID determinista para el seed (los hooks exigen UUID válido). */
function duid(n: number): string {
  return `11111111-2222-3333-4444-${String(n).padStart(12, '0')}`;
}

export interface DemoDb {
  profile: { first_name: string; last_name: string; phone: string };
  prefs: {
    offers: boolean;
    new_lots: boolean;
    order_updates: boolean;
    shipping_updates: boolean;
    availability: boolean;
  };
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string }[];
  companies: any[];
  company_members: any[];
  warehouses: any[];
  packages: any[];
  lots: any[];
  tiers: any[];
  favorites: string[];
  reviews: any[];
  addresses: any[];
  orders: any[];
  shipments: any[];
  notifications: any[];
  messages: any[];
  tickets: any[];
  ticketMessages: any[];
  users: any[];
  movements: any[];
  promotions: any[];
  promotionLots: any[];
  faqs: any[];
  payments: any[];
  seq: { order: number; ticket: number };
}

function seedDb(): DemoDb {
  const cat = (n: number, name: string, slug: string) => ({
    id: duid(n),
    name,
    slug,
  });
  const categories = [
    cat(11, 'Electrónica', 'electronica'),
    cat(12, 'Hogar', 'hogar'),
    cat(13, 'Moda', 'moda'),
    cat(14, 'Juguetería', 'jugueteria'),
    cat(15, 'Automotriz', 'automotriz'),
    cat(16, 'Herramientas', 'herramientas'),
  ];
  const companies = [
    {
      id: duid(21),
      name: 'Andina Cargo S.A.S.',
      tax_id: '900123456',
      verification_code: 'LOG-9982-RP',
      is_verified: true,
      contact_email: 'operaciones@andinacargo.com',
      contact_phone: '+57 601 555 0101',
      city: 'Bogotá D.C.',
      country: 'Colombia',
      agreement_details: 'Entrega semanal de paquetes no reclamados.',
    },
    {
      id: duid(22),
      name: 'Pacífico Express',
      tax_id: '900654321',
      verification_code: null,
      is_verified: false,
      contact_email: 'contacto@pacificoexpress.com',
      contact_phone: '+57 602 555 0202',
      city: 'Cali',
      country: 'Colombia',
      agreement_details: null,
    },
  ];
  const warehouses = [
    { id: duid(31), code: 'BOG-01', name: 'Bodega Central Bogotá', city: 'Bogotá D.C.', country: 'Colombia', capacity_lots: 5000 },
    { id: duid(32), code: 'MED-01', name: 'Bodega Medellín', city: 'Medellín', country: 'Colombia', capacity_lots: 2000 },
  ];

  const lot = (
    n: number,
    o: Record<string, any>,
  ) => ({
    id: duid(n),
    sku: o.sku,
    title: o.title,
    description: o.description,
    base_price: o.base_price,
    msrp_reference: o.msrp,
    currency: 'COP',
    stock_quantity: o.stock,
    status: 'published',
    is_verified: o.verified,
    packaging_state: o.packaging,
    product_state: o.state,
    unit_count: o.units,
    total_weight_kg: o.weight,
    length_cm: 120,
    width_cm: 100,
    height_cm: 150,
    warehouse_zone: o.zone,
    is_featured: Boolean(o.featured),
    published_at: '2026-09-01T10:00:00.000Z',
    circularity_percent: 92,
    waste_avoided_kg: 142,
    warehouses: { code: 'BOG-01', name: 'Bodega Central Bogotá', city: 'Bogotá D.C.' },
    brands: o.brand ? { name: o.brand } : null,
    companies: { name: 'Andina Cargo S.A.S.', is_verified: true },
    company_id: companies[0].id,
    warehouse_id: warehouses[0].id,
    lot_categories: o.cats.map((c: number) => ({
      categories: categories.find((x) => x.id === duid(c)),
    })),
    lot_images: [],
    reviews: o.ratings.map((r: number) => ({ rating: r })),
  });

  const lots = [
    lot(101, {
      sku: 'RP-99231', title: 'Lote Mixto Electrónica A1',
      description: 'Pallet con electrónica de consumo verificada: audio, cómputo y accesorios.',
      base_price: 2940000, msrp: 4900000, stock: 3, verified: true,
      packaging: 'original', state: 'intact', units: 120, weight: 450,
      zone: 'Pasillo 4', featured: true, brand: 'Varios', cats: [11], ratings: [5, 4, 5],
    }),
    lot(102, {
      sku: 'RP-88402', title: 'Mix Hogar Grado B',
      description: 'Pequeños electrodomésticos con caja dañada, funcionales.',
      base_price: 1850000, msrp: 3100000, stock: 5, verified: false,
      packaging: 'damaged', state: 'functional', units: 80, weight: 320,
      zone: 'Muelle 2', featured: true, brand: null, cats: [12], ratings: [4],
    }),
    lot(103, {
      sku: 'RP-99105', title: 'Set Herramientas Pro',
      description: 'Herramientas eléctricas selladas de devolución comercial.',
      base_price: 3200000, msrp: 4300000, stock: 2, verified: true,
      packaging: 'original', state: 'intact', units: 60, weight: 280,
      zone: 'Pasillo 1', featured: false, brand: 'ProTools', cats: [16], ratings: [5, 5],
    }),
    lot(104, {
      sku: 'RP-99250', title: 'Lote Smart Home IoT',
      description: 'Dispositivos IoT: bombillos, sensores y asistentes.',
      base_price: 4100000, msrp: 5900000, stock: 4, verified: true,
      packaging: 'original', state: 'intact', units: 45, weight: 120,
      zone: 'Pasillo 4', featured: false, brand: null, cats: [11], ratings: [],
    }),
    lot(105, {
      sku: 'RP-87001', title: 'Pallet Devoluciones Oficina',
      description: 'Electrónica de oficina sin caja, para repuestos o reacondicionar.',
      base_price: 1250000, msrp: null, stock: 6, verified: false,
      packaging: 'no_box', state: 'for_parts', units: 200, weight: 510,
      zone: 'Muelle 1', featured: false, brand: null, cats: [11], ratings: [3],
    }),
    lot(106, {
      sku: 'RP-99300', title: 'Lote Moda Temporada',
      description: 'Vestuario y calzado de temporada, tallas surtidas.',
      base_price: 2100000, msrp: 3500000, stock: 8, verified: true,
      packaging: 'original', state: 'intact', units: 300, weight: 260,
      zone: 'Pasillo 2', featured: true, brand: null, cats: [13], ratings: [4, 4],
    }),
  ];

  const tiers = [
    { id: duid(111), lot_id: lots[0].id, min_quantity: 5, unit_price: 2790000 },
    { id: duid(112), lot_id: lots[0].id, min_quantity: 10, unit_price: 2650000 },
    { id: duid(113), lot_id: lots[5].id, min_quantity: 5, unit_price: 1995000 },
  ];

  const orders = [
    {
      id: duid(201),
      order_number: 'RP-2026-000123',
      buyer_id: DEMO_USER_ID,
      status: 'delivered',
      subtotal: 2940000,
      shipping_cost: 45000,
      tax_amount: 567150,
      total: 3552150,
      currency: 'COP',
      payment_method_id: duid(401),
      carrier: 'RecuperaLogistics',
      created_at: '2026-08-20T15:30:00.000Z',
      ship_recipient_name: 'Demo Usuario',
      ship_phone: '+57 300 123 4567',
      ship_city: 'Bogotá D.C.',
      ship_address_line: 'Calle 100 #15-20, Apto 501',
      payment_methods: { name: 'Tarjeta de Crédito / Débito' },
      order_items: [
        {
          id: duid(211), quantity: 1, unit_price: 2940000, line_total: 2940000,
          lots: { id: lots[0].id, sku: lots[0].sku, title: lots[0].title },
        },
      ],
    },
    {
      id: duid(202),
      order_number: 'RP-2026-000131',
      buyer_id: DEMO_USER_ID,
      status: 'in_transit',
      subtotal: 1850000,
      shipping_cost: 45000,
      tax_amount: 360100,
      total: 2255100,
      currency: 'COP',
      payment_method_id: duid(402),
      carrier: 'RecuperaLogistics',
      created_at: '2026-09-05T09:12:00.000Z',
      ship_recipient_name: 'Demo Usuario',
      ship_phone: '+57 300 123 4567',
      ship_city: 'Medellín',
      ship_address_line: 'Carrera 43A #10-25',
      payment_methods: { name: 'PSE / Transferencia Bancaria' },
      order_items: [
        {
          id: duid(212), quantity: 1, unit_price: 1850000, line_total: 1850000,
          lots: { id: lots[1].id, sku: lots[1].sku, title: lots[1].title },
        },
      ],
    },
  ];

  return {
    profile: { first_name: 'Demo', last_name: 'Usuario', phone: '+57 300 123 4567' },
    prefs: { offers: true, new_lots: true, order_updates: true, shipping_updates: true, availability: false },
    categories,
    brands: [
      { id: duid(41), name: 'ProTools' },
      { id: duid(42), name: 'Varios' },
    ],
    companies,
    company_members: [
      { company_id: companies[0].id, profile_id: DEMO_USER_ID, company_role: 'owner' },
      { company_id: companies[0].id, profile_id: OWNER_ID, company_role: 'member' },
    ],
    warehouses,
    packages: [
      {
        id: duid(51), company_id: companies[0].id, received_at: '2026-08-28T08:00:00.000Z',
        origin: 'Vuelo AV-920 · Miami', total_units: 120, total_weight_kg: 450,
        status: 'processed', notes: 'Origen del lote RP-99231',
        companies: { name: companies[0].name },
      },
      {
        id: duid(52), company_id: companies[0].id, received_at: '2026-09-03T08:00:00.000Z',
        origin: 'Terrestre · Cali', total_units: 300, total_weight_kg: 260,
        status: 'classified', notes: null, companies: { name: companies[0].name },
      },
      {
        id: duid(53), company_id: companies[1].id, received_at: '2026-09-06T08:00:00.000Z',
        origin: 'Marítimo · Buenaventura', total_units: 500, total_weight_kg: 900,
        status: 'received', notes: null, companies: { name: companies[1].name },
      },
    ],
    lots,
    tiers,
    favorites: [lots[0].id, lots[5].id],
    reviews: [
      {
        id: duid(61), lot_id: lots[0].id, rating: 5, title: 'Excelente lote',
        comment: 'Todo verificado y bien empacado. Volveré a comprar.',
        is_verified_purchase: true, created_at: '2026-08-25T10:00:00.000Z',
        profiles: { first_name: 'Carolina' },
      },
      {
        id: duid(62), lot_id: lots[0].id, rating: 4, title: 'Bueno',
        comment: 'Un par de unidades con caja abierta, pero funcionales.',
        is_verified_purchase: true, created_at: '2026-08-27T10:00:00.000Z',
        profiles: { first_name: 'Andrés' },
      },
    ],
    addresses: [
      {
        id: duid(71), label: 'Casa', recipient_name: 'Demo Usuario',
        phone: '+57 300 123 4567', city: 'Bogotá D.C.',
        address_line: 'Calle 100 #15-20, Apto 501', delivery_notes: 'Portería 24h',
        is_default: true,
      },
    ],
    orders,
    shipments: [
      {
        id: duid(81), order_id: orders[0].id, carrier: 'RecuperaLogistics',
        tracking_number: 'RP-88341209', status: 'delivered',
        shipped_at: '2026-08-21T08:00:00.000Z', estimated_at: '2026-08-23T18:00:00.000Z',
        delivered_at: '2026-08-23T15:40:00.000Z',
        shipment_events: [
          { status: 'picked_up', location_text: 'Bodega Central Bogotá', event_at: '2026-08-21T08:00:00.000Z' },
          { status: 'in_transit', location_text: 'Centro de distribución', event_at: '2026-08-22T09:00:00.000Z' },
          { status: 'out_for_delivery', location_text: 'Bogotá D.C.', event_at: '2026-08-23T07:30:00.000Z' },
          { status: 'delivered', location_text: 'Calle 100 #15-20', event_at: '2026-08-23T15:40:00.000Z' },
        ],
      },
      {
        id: duid(82), order_id: orders[1].id, carrier: 'RecuperaLogistics',
        tracking_number: 'RP-88341577', status: 'in_transit',
        shipped_at: '2026-09-06T08:00:00.000Z', estimated_at: '2026-09-09T18:00:00.000Z',
        delivered_at: null,
        shipment_events: [
          { status: 'picked_up', location_text: 'Bodega Central Bogotá', event_at: '2026-09-06T08:00:00.000Z' },
          { status: 'in_transit', location_text: 'Ruta Bogotá–Medellín', event_at: '2026-09-07T06:00:00.000Z' },
        ],
      },
    ],
    notifications: [
      {
        id: duid(91), type: 'shipping_update', title: 'Tu pedido va en camino',
        body: 'RP-2026-000131 fue recogido en bodega.', lot_id: null,
        order_id: orders[1].id, is_read: false, created_at: '2026-09-06T08:05:00.000Z',
      },
      {
        id: duid(92), type: 'offer', title: 'Nuevo lote destacado: Moda Temporada',
        body: 'Lote RP-99300 con 40% de descuento.', lot_id: lots[5].id,
        order_id: null, is_read: false, created_at: '2026-09-04T10:00:00.000Z',
      },
      {
        id: duid(93), type: 'order_update', title: 'Pedido entregado',
        body: 'RP-2026-000123 fue entregado. ¡Califica tus lotes!',
        lot_id: null, order_id: orders[0].id, is_read: true,
        created_at: '2026-08-23T15:45:00.000Z',
      },
    ],
    messages: [
      {
        id: duid(95), lot_id: lots[0].id, sender_id: DEMO_USER_ID, receiver_id: OWNER_ID,
        body: 'Hola, ¿el precio incluye el envío a Medellín?', is_read: true,
        created_at: '2026-09-02T10:45:00.000Z',
      },
      {
        id: duid(96), lot_id: lots[0].id, sender_id: OWNER_ID, receiver_id: DEMO_USER_ID,
        body: 'Buen día. El precio es EXW en bodega, pero cotizamos el flete.',
        is_read: false, created_at: '2026-09-02T10:48:00.000Z',
      },
    ],
    tickets: [],
    ticketMessages: [],
    users: [
      {
        id: DEMO_USER_ID, first_name: 'Demo', last_name: 'Usuario',
        phone: '+57 300 123 4567', is_active: true,
        created_at: '2026-09-01T09:00:00.000Z', roles: { code: 'admin', name: 'Administrador' },
      },
      {
        id: OWNER_ID, first_name: 'Marco', last_name: 'Reus',
        phone: '+57 601 555 0101', is_active: true,
        created_at: '2026-08-15T09:00:00.000Z', roles: { code: 'company', name: 'Empresa proveedora' },
      },
      {
        id: ADMIN_ID, first_name: 'Ana', last_name: 'Admin',
        phone: null, is_active: true,
        created_at: '2026-07-01T09:00:00.000Z', roles: { code: 'admin', name: 'Administrador' },
      },
    ],
    movements: [
      {
        id: duid(97), lot_id: lots[0].id, movement_type: 'inbound', quantity: 4,
        reference: 'PKG-51', notes: 'Recepción inicial', created_at: '2026-08-28T08:00:00.000Z',
        lots: { sku: lots[0].sku, title: lots[0].title },
      },
      {
        id: duid(98), lot_id: lots[0].id, movement_type: 'sale', quantity: 1,
        reference: 'RP-2026-000123', notes: null, created_at: '2026-08-20T15:30:00.000Z',
        lots: { sku: lots[0].sku, title: lots[0].title },
      },
    ],
    promotions: [
      {
        id: duid(99), title: 'Semana Mayorista', description: 'Descuentos en lotes verificados.',
        discount_percent: 10, starts_at: null, ends_at: null, is_active: true,
      },
    ],
    promotionLots: [{ promotion_id: duid(99), lot_id: lots[5].id }],
    faqs: [
      { id: duid(1001), category: 'plataforma', question: '¿Cómo funciona RecuperaPack?', answer: 'Recuperamos paquetes no reclamados y los vendemos en lotes verificados con descuento.', sort_order: 1 },
      { id: duid(1002), category: 'despachos', question: '¿Cómo sigo mi pedido?', answer: 'Cada pedido tiene número de seguimiento visible en Mis pedidos.', sort_order: 2 },
    ],
    payments: [
      { id: duid(401), code: 'card', name: 'Tarjeta de Crédito / Débito', description: 'Hasta 12 cuotas.' },
      { id: duid(402), code: 'pse', name: 'PSE / Transferencia Bancaria', description: 'Débito directo.' },
      { id: duid(403), code: 'bank_transfer', name: 'Transferencia Bancaria', description: 'Directa a la plataforma.' },
      { id: duid(404), code: 'cash_on_delivery', name: 'Pago contra entrega', description: 'Sujeto a cobertura.' },
    ],
    seq: { order: 200, ticket: 1 },
  };
}

export function getDb(): DemoDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    /* siembra de nuevo */
  }
  const db = seedDb();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* noop */
  }
  return db;
}

export function saveDb(db: DemoDb) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* noop */
  }
}

/** Crea un pedido demo (checkout) con número secuencial DEMO-####. */
export function createDemoOrder(input: {
  items: { lotId: string; qty: number; unitPrice: number }[];
  shippingCost: number;
  taxAmount: number;
  ship: { recipient: string; phone: string; city: string; address: string; notes: string };
  paymentName: string;
}): string {
  const db = getDb();
  db.seq.order += 1;
  const id = duid(200 + db.seq.order);
  const orderNumber = `DEMO-${String(db.seq.order).padStart(4, '0')}`;
  const subtotal = input.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const items = input.items.map((i, idx) => {
    const lot = db.lots.find((l) => l.id === i.lotId);
    if (lot) lot.stock_quantity = Math.max(0, lot.stock_quantity - i.qty);
    return {
      id: `${id}-${idx}`,
      quantity: i.qty,
      unit_price: i.unitPrice,
      line_total: i.qty * i.unitPrice,
      lots: lot ? { id: lot.id, sku: lot.sku, title: lot.title } : null,
    };
  });
  db.orders.unshift({
    id,
    order_number: orderNumber,
    buyer_id: DEMO_USER_ID,
    status: 'pending_payment',
    subtotal,
    shipping_cost: input.shippingCost,
    tax_amount: input.taxAmount,
    total: subtotal + input.shippingCost + input.taxAmount,
    currency: 'COP',
    payment_method_id: null,
    carrier: 'RecuperaLogistics',
    created_at: new Date().toISOString(),
    ship_recipient_name: input.ship.recipient,
    ship_phone: input.ship.phone,
    ship_city: input.ship.city,
    ship_address_line: input.ship.address,
    payment_methods: { name: input.paymentName },
    order_items: items,
  });
  saveDb(db);
  return id;
}
