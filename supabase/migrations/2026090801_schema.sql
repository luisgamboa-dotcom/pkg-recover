-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 1: esquema base
-- Separación conceptual (prompt §7): packages (físico) -> lots (publicación)
-- -> orders + order_items (venta). Sin contraseñas (usa auth.users).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create sequence if not exists order_number_seq;
create sequence if not exists lot_sku_seq;
create sequence if not exists ticket_number_seq;

-- --------------------------------------------------------------------------
-- Roles y perfiles (prompt §8, §22, §24). Sin passwords: auth.users manda.
-- --------------------------------------------------------------------------
create table public.roles (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique check (code in ('customer','reseller','company','admin')),
  name        text        not null,
  description text,
  permissions jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  role_id    uuid        not null references public.roles (id) on delete restrict,
  first_name text,
  last_name  text,
  phone      text,
  avatar_url text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_id_idx on public.profiles (role_id);

-- --------------------------------------------------------------------------
-- Empresas proveedoras (prompt §9) + miembros (una empresa, N usuarios)
-- --------------------------------------------------------------------------
create table public.companies (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  tax_id            text        unique,              -- NIT / identificación fiscal
  verification_code text        unique,              -- ej. LOG-9982-RP (lo asigna admin)
  is_verified       boolean     not null default false,
  contact_email     text,
  contact_phone     text,
  address_line      text,
  city              text        not null default 'Bogotá D.C.',
  country           text        not null default 'Colombia',
  agreement_details text,                            -- convenios con la plataforma
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.company_members (
  id           uuid        primary key default gen_random_uuid(),
  company_id   uuid        not null references public.companies (id) on delete cascade,
  profile_id   uuid        not null references public.profiles (id) on delete cascade,
  company_role text        not null default 'member' check (company_role in ('owner','member')),
  created_at   timestamptz not null default now(),
  unique (company_id, profile_id)
);
create index company_members_profile_id_idx on public.company_members (profile_id);

-- --------------------------------------------------------------------------
-- Bodegas / centros de cumplimiento (origen de "WH-East (Aisle 4)")
-- --------------------------------------------------------------------------
create table public.warehouses (
  id            uuid        primary key default gen_random_uuid(),
  code          text        not null unique,         -- ej. BOG-01
  name          text        not null,
  city          text        not null,
  country       text        not null default 'Colombia',
  address_line  text,
  capacity_lots integer     check (capacity_lots is null or capacity_lots >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Catálogo: categorías (entidad independiente, prompt §12), marcas
-- --------------------------------------------------------------------------
create table public.categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,           -- Electrónica, Hogar, Moda...
  slug        text        not null unique,
  description text,
  image_url   text,
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.brands (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null unique,
  slug       text        not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Paquetes físicos recibidos (prompt §17)
-- --------------------------------------------------------------------------
create table public.packages (
  id              uuid        primary key default gen_random_uuid(),
  company_id      uuid        references public.companies (id) on delete set null,
  received_at     timestamptz not null default now(),
  origin          text,                              -- origen del paquete
  total_units     integer     not null default 0 check (total_units >= 0),
  total_weight_kg numeric(10,2) not null default 0 check (total_weight_kg >= 0),
  status          text        not null default 'received'
                  check (status in ('received','inspecting','classified','processed','cancelled')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index packages_company_id_idx on public.packages (company_id);
create index packages_status_idx on public.packages (status);

-- --------------------------------------------------------------------------
-- Lotes = publicación comercial (prompt §7). Unidad de venta de la UI.
-- --------------------------------------------------------------------------
create table public.lots (
  id                   uuid        primary key default gen_random_uuid(),
  sku                  text        not null unique,   -- RP-99231 (trigger si viene null)
  company_id           uuid        references public.companies (id) on delete set null,
  package_id           uuid        references public.packages (id) on delete set null,
  warehouse_id         uuid        references public.warehouses (id) on delete set null,
  warehouse_zone       text,                          -- Aisle 4 / Dock 2
  brand_id             uuid        references public.brands (id) on delete set null,
  title                text        not null,          -- "Lote Mixto Electrónica A1"
  description          text,
  packaging_state      text        not null default 'original'
                       check (packaging_state in ('original','damaged','no_box')),
  product_state        text        not null default 'intact'
                       check (product_state in ('intact','functional','for_parts')),
  is_verified          boolean     not null default false,
  unit_count           integer     not null check (unit_count > 0),   -- unidades dentro del lote
  total_weight_kg      numeric(10,2) not null default 0 check (total_weight_kg >= 0),
  length_cm            numeric(8,2)  check (length_cm is null or length_cm > 0),
  width_cm             numeric(8,2)  check (width_cm is null or width_cm > 0),
  height_cm            numeric(8,2)  check (height_cm is null or height_cm > 0),
  base_price           numeric(12,2) not null check (base_price >= 0), -- precio total del lote
  msrp_reference       numeric(12,2) check (msrp_reference is null or msrp_reference >= 0),
  currency             char(3)     not null default 'COP' check (currency in ('COP','USD')),
  stock_quantity       integer     not null default 1 check (stock_quantity >= 0), -- lotes disponibles
  status               text        not null default 'draft'
                       check (status in ('draft','published','paused','sold_out','archived')),
  is_featured          boolean     not null default false,
  circularity_percent  numeric(5,2)  check (circularity_percent is null
                                         or (circularity_percent >= 0 and circularity_percent <= 100)),
  waste_avoided_kg     numeric(10,2) check (waste_avoided_kg is null or waste_avoided_kg >= 0),
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index lots_status_published_idx on public.lots (status, published_at);
create index lots_company_id_idx  on public.lots (company_id);
create index lots_warehouse_id_idx on public.lots (warehouse_id);
create index lots_brand_id_idx    on public.lots (brand_id);
create index lots_title_trgm_idx  on public.lots using gin (title gin_trgm_ops);

-- N:M categorías <-> lotes (prompt §5). Sin duplicados.
create table public.lot_categories (
  lot_id      uuid not null references public.lots (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (lot_id, category_id)
);
create index lot_categories_category_id_idx on public.lot_categories (category_id);

-- Imágenes (solo referencias a Storage, prompt §17)
create table public.lot_images (
  id           uuid        primary key default gen_random_uuid(),
  lot_id       uuid        not null references public.lots (id) on delete cascade,
  storage_path text        not null,                  -- ruta en bucket lot-images
  alt_text     text,
  sort_order   integer     not null default 0,
  is_primary   boolean     not null default false,
  created_at   timestamptz not null default now()
);
create index lot_images_lot_id_idx on public.lot_images (lot_id);
create unique index lot_images_single_primary_uidx
  on public.lot_images (lot_id) where is_primary;

-- Precios por volumen para revendedores (prompt §21)
create table public.lot_price_tiers (
  id           uuid        primary key default gen_random_uuid(),
  lot_id       uuid        not null references public.lots (id) on delete cascade,
  min_quantity integer     not null check (min_quantity >= 1),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  created_at   timestamptz not null default now(),
  unique (lot_id, min_quantity)
);
create index lot_price_tiers_lot_id_idx on public.lot_price_tiers (lot_id);

-- Libro de movimientos de inventario (prompt §11). Inmutable: sin updated_at.
create table public.inventory_movements (
  id             uuid        primary key default gen_random_uuid(),
  lot_id         uuid        not null references public.lots (id) on delete restrict,
  warehouse_id   uuid        references public.warehouses (id) on delete set null,
  movement_type  text        not null
                 check (movement_type in ('inbound','sale','adjustment','return','removal')),
  quantity       integer     not null check (quantity > 0),
  reference      text,                                -- ej. order_number
  notes          text,
  created_by     uuid        references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index inventory_movements_lot_id_idx on public.inventory_movements (lot_id, created_at desc);

-- --------------------------------------------------------------------------
-- Métodos de pago = catálogo (prompt §14). Sin datos de tarjetas.
-- --------------------------------------------------------------------------
create table public.payment_methods (
  id                  uuid        primary key default gen_random_uuid(),
  code                text        not null unique
                      check (code in ('card','pse','bank_transfer','cash_on_delivery')),
  name                text        not null,
  description         text,
  allows_installments boolean     not null default false,
  max_installments    integer     check (max_installments is null or max_installments > 0),
  is_active           boolean     not null default true,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Direcciones de despacho del comprador (prompt §10)
-- --------------------------------------------------------------------------
create table public.addresses (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        not null references public.profiles (id) on delete cascade,
  label          text,                                -- Casa / Oficina / Bodega
  recipient_name text        not null,
  phone          text        not null,
  city           text        not null,
  address_line   text        not null,
  delivery_notes text,
  is_default     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index addresses_profile_id_idx on public.addresses (profile_id);

-- --------------------------------------------------------------------------
-- Ventas: cabecera + detalle (prompt §13). Precio histórico en el detalle.
-- --------------------------------------------------------------------------
create table public.orders (
  id                 uuid        primary key default gen_random_uuid(),
  order_number       text        not null unique,     -- RP-2026-000123 (trigger)
  buyer_id           uuid        not null references public.profiles (id) on delete restrict,
  status             text        not null default 'pending_payment'
                     check (status in ('pending_payment','paid','preparing','shipped',
                                       'delivered','cancelled','returned')),
  subtotal           numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_cost      numeric(12,2) not null default 0 check (shipping_cost >= 0),
  tax_amount         numeric(12,2) not null default 0 check (tax_amount >= 0), -- IVA 19%
  total              numeric(12,2) not null default 0 check (total >= 0),
  currency           char(3)     not null default 'COP' check (currency in ('COP','USD')),
  payment_method_id  uuid        references public.payment_methods (id) on delete restrict,
  shipping_address_id uuid       references public.addresses (id) on delete set null,
  ship_recipient_name text       not null,            -- snapshot histórico
  ship_phone          text       not null,
  ship_city           text       not null,
  ship_address_line   text       not null,
  ship_notes          text,
  carrier             text,                            -- RecuperaLogistics
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_buyer_id_idx on public.orders (buyer_id, created_at desc);
create index orders_status_idx   on public.orders (status);

create table public.order_items (
  id         uuid        primary key default gen_random_uuid(),
  order_id   uuid        not null references public.orders (id) on delete cascade,
  lot_id     uuid        not null references public.lots (id) on delete restrict,
  quantity   integer     not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),  -- precio histórico
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  unique (order_id, lot_id)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_lot_id_idx   on public.order_items (lot_id);

-- --------------------------------------------------------------------------
-- Despachos + historial de seguimiento (prompt §15)
-- --------------------------------------------------------------------------
create table public.shipments (
  id                  uuid        primary key default gen_random_uuid(),
  order_id            uuid        not null unique references public.orders (id) on delete cascade,
  carrier             text        not null default 'RecuperaLogistics',
  tracking_number     text        unique,
  status              text        not null default 'pending'
                      check (status in ('pending','picked_up','in_transit','out_for_delivery',
                                        'delivered','failed','returned')),
  origin_warehouse_id uuid        references public.warehouses (id) on delete set null,
  shipped_at          timestamptz,
  estimated_at        timestamptz,
  delivered_at        timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index shipments_tracking_number_idx on public.shipments (tracking_number);

create table public.shipment_events (
  id           uuid        primary key default gen_random_uuid(),
  shipment_id  uuid        not null references public.shipments (id) on delete cascade,
  status       text        not null,
  location_text text,
  notes        text,
  event_at     timestamptz not null default now()
);
create index shipment_events_shipment_id_idx
  on public.shipment_events (shipment_id, event_at desc);

-- --------------------------------------------------------------------------
-- Favoritos N:M (prompt §16), reseñas, notificaciones, soporte, mensajería
-- --------------------------------------------------------------------------
create table public.favorites (
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  lot_id     uuid        not null references public.lots (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, lot_id)
);
create index favorites_lot_id_idx on public.favorites (lot_id);

create table public.reviews (
  id                   uuid        primary key default gen_random_uuid(),
  lot_id               uuid        not null references public.lots (id) on delete cascade,
  profile_id           uuid        not null references public.profiles (id) on delete cascade,
  order_id             uuid        references public.orders (id) on delete set null,
  rating               integer     not null check (rating between 1 and 5),
  title                text,
  comment              text,
  is_verified_purchase boolean     not null default false,
  is_visible           boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (profile_id, lot_id)
);
create index reviews_lot_id_idx on public.reviews (lot_id);

create table public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  type       text        not null
             check (type in ('offer','new_lot','order_update','shipping_update','availability','system')),
  title      text        not null,
  body       text,
  lot_id     uuid        references public.lots (id) on delete set null,
  order_id   uuid        references public.orders (id) on delete set null,
  is_read    boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_profile_id_idx
  on public.notifications (profile_id, is_read, created_at desc);

create table public.notification_preferences (
  profile_id     uuid    primary key references public.profiles (id) on delete cascade,
  offers         boolean not null default true,
  new_lots       boolean not null default true,
  order_updates  boolean not null default true,
  shipping_updates boolean not null default true,
  availability   boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table public.support_tickets (
  id           uuid        primary key default gen_random_uuid(),
  ticket_number text       not null unique,           -- SUP-000123 (trigger)
  profile_id   uuid        not null references public.profiles (id) on delete cascade,
  order_id     uuid        references public.orders (id) on delete set null,
  subject      text        not null,
  category     text        not null default 'other'
               check (category in ('order','payment','shipping','product','account','other')),
  status       text        not null default 'open'
               check (status in ('open','in_progress','resolved','closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index support_tickets_profile_id_idx on public.support_tickets (profile_id);

create table public.ticket_messages (
  id         uuid        primary key default gen_random_uuid(),
  ticket_id  uuid        not null references public.support_tickets (id) on delete cascade,
  sender_id  uuid        not null references public.profiles (id) on delete restrict,
  body       text        not null,
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_id_idx
  on public.ticket_messages (ticket_id, created_at);

-- Mensajería directa comprador <-> vendedor por lote (pantalla Carga B2B)
create table public.messages (
  id          uuid        primary key default gen_random_uuid(),
  lot_id      uuid        not null references public.lots (id) on delete cascade,
  sender_id   uuid        not null references public.profiles (id) on delete cascade,
  receiver_id uuid        not null references public.profiles (id) on delete cascade,
  body        text        not null,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create index messages_lot_participants_idx
  on public.messages (lot_id, receiver_id, created_at desc);

-- --------------------------------------------------------------------------
-- Promociones y ofertas (prompt §18)
-- --------------------------------------------------------------------------
create table public.promotions (
  id               uuid        primary key default gen_random_uuid(),
  title            text        not null,
  description      text,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index promotions_active_idx on public.promotions (is_active);

create table public.promotion_lots (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  lot_id       uuid not null references public.lots (id) on delete cascade,
  primary key (promotion_id, lot_id)
);
create index promotion_lots_lot_id_idx on public.promotion_lots (lot_id);

-- --------------------------------------------------------------------------
-- FAQs / Centro de ayuda (prompt §14, §26)
-- --------------------------------------------------------------------------
create table public.faqs (
  id         uuid        primary key default gen_random_uuid(),
  category   text        not null default 'general',
  question   text        not null,
  answer     text        not null,
  sort_order integer     not null default 0,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_active_idx on public.faqs (is_active, sort_order);

-- ============================================================================
-- Triggers y funciones (solo los necesarios, prompt §23)
-- ============================================================================

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_roles_updated_at        before update on public.roles        for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at     before update on public.profiles     for each row execute function public.set_updated_at();
create trigger trg_companies_updated_at    before update on public.companies    for each row execute function public.set_updated_at();
create trigger trg_warehouses_updated_at   before update on public.warehouses   for each row execute function public.set_updated_at();
create trigger trg_categories_updated_at   before update on public.categories   for each row execute function public.set_updated_at();
create trigger trg_brands_updated_at       before update on public.brands       for each row execute function public.set_updated_at();
create trigger trg_packages_updated_at     before update on public.packages     for each row execute function public.set_updated_at();
create trigger trg_lots_updated_at         before update on public.lots         for each row execute function public.set_updated_at();
create trigger trg_payment_methods_updated_at before update on public.payment_methods for each row execute function public.set_updated_at();
create trigger trg_addresses_updated_at    before update on public.addresses    for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at       before update on public.orders       for each row execute function public.set_updated_at();
create trigger trg_shipments_updated_at    before update on public.shipments    for each row execute function public.set_updated_at();
create trigger trg_reviews_updated_at      before update on public.reviews      for each row execute function public.set_updated_at();
create trigger trg_notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create trigger trg_notification_prefs_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
create trigger trg_support_tickets_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();
create trigger trg_promotions_updated_at   before update on public.promotions   for each row execute function public.set_updated_at();
create trigger trg_faqs_updated_at         before update on public.faqs         for each row execute function public.set_updated_at();

-- Perfil + preferencias al registrarse (Supabase Auth). Justificación: evita
-- perfiles huérfanos y garantiza preferencias de notificación desde el día 0.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role_id uuid;
  v_role_code text;
begin
  -- El registro permite customer o reseller. Empresa queda como customer
  -- y un admin verifica y eleva el rol (la UI informa de este paso).
  v_role_code := coalesce(new.raw_user_meta_data ->> 'requested_role', 'customer');
  if v_role_code not in ('customer', 'reseller') then
    v_role_code := 'customer';
  end if;
  select id into v_role_id from public.roles where code = v_role_code limit 1;
  insert into public.profiles (id, role_id)
  values (new.id, v_role_id)
  on conflict (id) do nothing;
  insert into public.notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end $$;

create trigger trg_auth_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Códigos legibles: order_number (RP-2026-000123), sku (RP-99231), ticket (SUP-…).
-- Justificación: la UI exige identificadores de pedido/seguimiento (prompt §7).
create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number :=
      'RP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

create or replace function public.assign_lot_sku()
returns trigger language plpgsql as $$
begin
  if new.sku is null then
    new.sku := 'RP-' || lpad(nextval('lot_sku_seq')::text, 5, '0');
  end if;
  return new;
end $$;

create or replace function public.assign_ticket_number()
returns trigger language plpgsql as $$
begin
  if new.ticket_number is null then
    new.ticket_number := 'SUP-' || lpad(nextval('ticket_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

alter table public.orders alter column order_number drop not null;
alter table public.lots alter column sku drop not null;
alter table public.support_tickets alter column ticket_number drop not null;

create trigger trg_orders_assign_number  before insert on public.orders
  for each row execute function public.assign_order_number();
create trigger trg_lots_assign_sku       before insert on public.lots
  for each row execute function public.assign_lot_sku();
create trigger trg_tickets_assign_number before insert on public.support_tickets
  for each row execute function public.assign_ticket_number();

alter table public.orders alter column order_number set not null;
alter table public.lots alter column sku set not null;
alter table public.support_tickets alter column ticket_number set not null;

-- Totales de la orden recalculados desde el detalle (integridad, prompt §20).
create or replace function public.recalc_order_totals()
returns trigger language plpgsql as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2);
begin
  v_order_id := coalesce(new.order_id, old.order_id);
  select coalesce(sum(line_total), 0) into v_subtotal
    from public.order_items where order_id = v_order_id;
  update public.orders o
     set subtotal = v_subtotal,
         total    = v_subtotal + o.shipping_cost + o.tax_amount
   where o.id = v_order_id;
  return coalesce(new, old);
end $$;

create trigger trg_order_items_recalc
  after insert or update or delete on public.order_items
  for each row execute function public.recalc_order_totals();

-- Stock: descuenta al vender, impide vender sin existencias, restaura al
-- eliminar el ítem. Marca sold_out / republica automáticamente.
create or replace function public.apply_stock_delta(p_lot_id uuid, p_delta integer)
returns void language plpgsql as $$
declare
  v_stock integer;
begin
  update public.lots
     set stock_quantity = stock_quantity + p_delta
   where id = p_lot_id
  returning stock_quantity into v_stock;

  if v_stock is null then
    raise exception 'Lote % no existe', p_lot_id;
  end if;
  if v_stock < 0 then
    raise exception 'Stock insuficiente para el lote %', p_lot_id;
  end if;

  update public.lots
     set status = case when stock_quantity = 0 then 'sold_out'
                       when status = 'sold_out' then 'published'
                       else status end
   where id = p_lot_id;
end $$;

create or replace function public.adjust_lot_stock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_stock_delta(new.lot_id, -new.quantity);
  elsif tg_op = 'DELETE' then
    perform public.apply_stock_delta(old.lot_id, old.quantity);
  else
    if new.lot_id = old.lot_id then
      perform public.apply_stock_delta(new.lot_id, old.quantity - new.quantity);
    else
      perform public.apply_stock_delta(old.lot_id, old.quantity);
      perform public.apply_stock_delta(new.lot_id, -new.quantity);
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_order_items_stock
  after insert or update or delete on public.order_items
  for each row execute function public.adjust_lot_stock();

-- ============================================================================
-- Vistas de reportería (prompt §23: estadísticas y valor recuperado)
-- ============================================================================
create view public.v_inventory_summary
with (security_invoker = true) as
select l.id, l.sku, l.title, l.status, l.stock_quantity, l.base_price,
       (l.stock_quantity * l.base_price) as stock_value,
       l.unit_count, l.total_weight_kg,
       w.code as warehouse_code, w.city as warehouse_city,
       c.name as company_name,
       (select count(*) from public.inventory_movements m where m.lot_id = l.id) as movements_count
  from public.lots l
  left join public.warehouses w on w.id = l.warehouse_id
  left join public.companies c on c.id = l.company_id;

create view public.v_company_recovery
with (security_invoker = true) as
select c.id as company_id, c.name as company_name,
       c.is_verified,
       (select count(*) from public.packages p where p.company_id = c.id) as packages_received,
       (select count(*) from public.lots l
         where l.company_id = c.id and l.status = 'published') as lots_published,
       coalesce(sum(oi.line_total), 0) as revenue_recovered,
       coalesce(sum(oi.quantity), 0) as lots_sold
  from public.companies c
  left join public.lots l on l.company_id = c.id
  left join public.order_items oi on oi.lot_id = l.id
  left join public.orders o on o.id = oi.order_id
    and o.status not in ('cancelled','returned')
 group by c.id, c.name, c.is_verified;

create view public.v_best_selling_lots
with (security_invoker = true) as
select l.id, l.sku, l.title, l.base_price,
       coalesce(sum(oi.quantity), 0) as units_sold,
       coalesce(sum(oi.line_total), 0) as revenue,
       count(distinct o.id) as orders_count
  from public.lots l
  left join public.order_items oi on oi.lot_id = l.id
  left join public.orders o on o.id = oi.order_id
    and o.status not in ('cancelled','returned')
 group by l.id, l.sku, l.title, l.base_price
 order by revenue desc;
