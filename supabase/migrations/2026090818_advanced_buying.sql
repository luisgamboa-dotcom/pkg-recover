-- ============================================================================
-- Migración 18: compra avanzada — Fase B (4, 8, 9, 17)
-- - price_alerts: avisos de baja de precio / vuelta de stock (one-shot).
-- - offers: contraofertas comprador ↔ empresa + conversión a pedido.
-- - auctions + auction_bids: subastas de liquidación con cierre.
-- - saved_filters: filtros de catálogo guardados por usuario.
-- Aplicar en Supabase (Dashboard → SQL o CLI: supabase db push).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4. Alertas de precio / stock
-- --------------------------------------------------------------------------
create table if not exists public.price_alerts (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles (id) on delete cascade,
  product_id   uuid        not null references public.products (id) on delete cascade,
  target_price numeric(12,2) not null check (target_price > 0),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  unique (profile_id, product_id)
);

create index if not exists price_alerts_product_idx
  on public.price_alerts (product_id) where is_active;

alter table public.price_alerts enable row level security;

drop policy if exists price_alerts_owner on public.price_alerts;
create policy price_alerts_owner on public.price_alerts
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- Aviso one-shot al cruzar el objetivo (baja de precio o vuelve el stock).
create or replace function public.notify_price_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Baja de precio: el nuevo precio cruza el objetivo hacia abajo.
  insert into public.notifications (profile_id, type, title, body, product_id)
  select a.profile_id, 'offer',
         'Bajó de precio: ' || new.title,
         'Ahora a $' || new.base_price || ' (tu objetivo: $' || a.target_price || ').',
         new.id
    from public.price_alerts a
    join public.notification_preferences p on p.profile_id = a.profile_id
   where a.product_id = new.id
     and a.is_active
     and p.offers
     and new.base_price <= a.target_price
     and old.base_price > a.target_price;

  update public.price_alerts a
     set is_active = false
   where a.product_id = new.id
     and a.is_active
     and new.base_price <= a.target_price
     and old.base_price > a.target_price;

  -- Vuelta de stock: de 0 a disponible.
  insert into public.notifications (profile_id, type, title, body, product_id)
  select a.profile_id, 'availability',
         'Volvió el stock: ' || new.title,
         'Ya puedes comprarlo antes de que se agote.',
         new.id
    from public.price_alerts a
    join public.notification_preferences p on p.profile_id = a.profile_id
   where a.product_id = new.id
     and a.is_active
     and p.availability
     and old.stock_quantity <= 0
     and new.stock_quantity > 0;

  update public.price_alerts a
     set is_active = false
   where a.product_id = new.id
     and a.is_active
     and old.stock_quantity <= 0
     and new.stock_quantity > 0;

  return new;
end;
$$;

drop trigger if exists trg_products_price_alerts on public.products;
create trigger trg_products_price_alerts
  after update of base_price, stock_quantity on public.products
  for each row execute function public.notify_price_alerts();

-- --------------------------------------------------------------------------
-- 8. Contraofertas
-- --------------------------------------------------------------------------
create table if not exists public.offers (
  id           uuid        primary key default gen_random_uuid(),
  product_id   uuid        not null references public.products (id) on delete cascade,
  buyer_id     uuid        not null references public.profiles (id) on delete cascade,
  quantity     integer     not null default 1 check (quantity > 0),
  amount       numeric(12,2) not null check (amount > 0),
  message      text,
  status       text        not null default 'pending'
               check (status in ('pending','accepted','rejected','converted','expired')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists offers_product_idx on public.offers (product_id, status);
create index if not exists offers_buyer_idx on public.offers (buyer_id, created_at desc);

alter table public.offers enable row level security;

drop policy if exists offers_buyer on public.offers;
create policy offers_buyer on public.offers
  for all using (buyer_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or public.is_admin());

drop policy if exists offers_seller on public.offers;
create policy offers_seller on public.offers
  for select using (
    exists (
      select 1 from public.products p
       where p.id = offers.product_id
         and p.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists offers_seller_update on public.offers;
create policy offers_seller_update on public.offers
  for update using (
    public.is_admin() or exists (
      select 1 from public.products p
       where p.id = offers.product_id
         and p.company_id in (select public.my_company_ids())
    )
  );

-- Respuesta a oferta → aviso al comprador.
create or replace function public.notify_offer_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if old.status = 'pending' and new.status in ('accepted','rejected') then
    select p.title into v_title from public.products p where p.id = new.product_id;
    insert into public.notifications (profile_id, type, title, body, product_id)
    select new.buyer_id, 'offer',
           case when new.status = 'accepted' then 'Oferta aceptada: ' || v_title
                else 'Oferta rechazada: ' || v_title end,
           case when new.status = 'accepted' then 'Tienes 48 h para concretar la compra desde tu lista de ofertas.'
                else 'Puedes hacer una nueva oferta o comprar al precio publicado.' end,
           new.product_id
      from public.notification_preferences p
     where p.profile_id = new.buyer_id
       and p.offers;
    update public.offers set responded_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_offers_notify on public.offers;
create trigger trg_offers_notify
  after update of status on public.offers
  for each row execute function public.notify_offer_response();

-- Conversión de oferta aceptada a pedido pendiente de pago
-- (usa la dirección principal del comprador como despacho).
create or replace function public.convert_offer_to_order(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer  public.offers%rowtype;
  v_addr   public.addresses%rowtype;
  v_order  uuid;
  v_sub    numeric(12,2);
begin
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'Oferta no encontrada.'; end if;
  if v_offer.status <> 'accepted' then raise exception 'Solo ofertas aceptadas.'; end if;

  select * into v_addr from public.addresses
   where profile_id = v_offer.buyer_id
   order by is_default desc, created_at
   limit 1;
  if not found then raise exception 'El comprador no tiene dirección de despacho.'; end if;

  v_sub := v_offer.amount * v_offer.quantity;

  insert into public.orders
    (buyer_id, payment_method_id, shipping_address_id,
     shipping_cost, tax_amount, currency,
     ship_recipient_name, ship_phone, ship_street_name, ship_street_number,
     ship_apartment, ship_commune, ship_city, ship_region, ship_postal_code)
  values
    (v_offer.buyer_id, null, v_addr.id,
     0, round(v_sub * 0.19, 0), 'CLP',
     v_addr.recipient_name, v_addr.phone, v_addr.street_name, v_addr.street_number,
     v_addr.apartment, v_addr.commune, v_addr.city, v_addr.region, v_addr.postal_code)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  values (v_order, v_offer.product_id, v_offer.quantity, v_offer.amount);

  update public.offers set status = 'converted' where id = p_offer_id;
  return v_order;
end;
$$;

-- --------------------------------------------------------------------------
-- 9. Subastas de liquidación
-- --------------------------------------------------------------------------
create table if not exists public.auctions (
  id             uuid        primary key default gen_random_uuid(),
  product_id     uuid        not null references public.products (id) on delete cascade,
  starting_price numeric(12,2) not null check (starting_price > 0),
  current_bid    numeric(12,2),
  current_bidder uuid        references public.profiles (id) on delete set null,
  ends_at        timestamptz not null,
  status         text        not null default 'active'
                 check (status in ('active','closed','cancelled')),
  created_at     timestamptz not null default now(),
  unique (product_id, status)
);

create table if not exists public.auction_bids (
  id         uuid        primary key default gen_random_uuid(),
  auction_id uuid        not null references public.auctions (id) on delete cascade,
  bidder_id  uuid        not null references public.profiles (id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists auctions_status_idx on public.auctions (status, ends_at);
create index if not exists auction_bids_auction_idx on public.auction_bids (auction_id, amount desc);

alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;

drop policy if exists auctions_select on public.auctions;
create policy auctions_select on public.auctions
  for select using (status = 'active' or public.is_admin() or
    exists (select 1 from public.products p
             where p.id = auctions.product_id
               and p.company_id in (select public.my_company_ids())));

drop policy if exists auctions_admin on public.auctions;
create policy auctions_admin on public.auctions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists auction_bids_select on public.auction_bids;
create policy auction_bids_select on public.auction_bids
  for select using (bidder_id = auth.uid() or public.is_admin() or
    exists (select 1 from public.auctions a
             join public.products p on p.id = a.product_id
            where a.id = auction_bids.auction_id
              and p.company_id in (select public.my_company_ids())));

drop policy if exists auction_bids_insert on public.auction_bids;
create policy auction_bids_insert on public.auction_bids
  for insert with check (bidder_id = auth.uid());

-- Validación de puja + actualización del máximo + aviso al superado.
create or replace function public.place_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions%rowtype;
  v_min     numeric(12,2);
  v_prev    uuid;
  v_title   text;
begin
  select * into v_auction from public.auctions where id = new.auction_id;
  if not found then raise exception 'Subasta no encontrada.'; end if;
  if v_auction.status <> 'active' then raise exception 'Subasta no activa.'; end if;
  if v_auction.ends_at <= now() then raise exception 'Subasta cerrada.'; end if;

  v_min := coalesce(v_auction.current_bid, v_auction.starting_price - 1);
  if new.amount <= v_min then raise exception 'La puja debe superar la actual.'; end if;

  v_prev := v_auction.current_bidder;
  select p.title into v_title from public.products p where p.id = v_auction.product_id;

  update public.auctions
     set current_bid = new.amount, current_bidder = new.bidder_id
   where id = new.auction_id;

  if v_prev is not null and v_prev <> new.bidder_id then
    insert into public.notifications (profile_id, type, title, body, product_id)
    select v_prev, 'offer', 'Puja superada: ' || v_title,
           'Nueva puja máxima: $' || new.amount || '.',
           v_auction.product_id
      from public.notification_preferences p
     where p.profile_id = v_prev
       and p.offers;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auction_bids on public.auction_bids;
create trigger trg_auction_bids
  before insert on public.auction_bids
  for each row execute function public.place_bid();

-- Cierre → aviso al ganador.
create or replace function public.notify_auction_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if old.status = 'active' and new.status = 'closed' and new.current_bidder is not null then
    select p.title into v_title from public.products p where p.id = new.product_id;
    insert into public.notifications (profile_id, type, title, body, product_id)
    select new.current_bidder, 'offer', '¡Ganaste la subasta: ' || v_title || '!',
           'Puja ganadora: $' || new.current_bid || '. Te contactaremos para concretar.',
           new.product_id
      from public.notification_preferences p
     where p.profile_id = new.current_bidder
       and p.offers;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auctions_close on public.auctions;
create trigger trg_auctions_close
  after update of status on public.auctions
  for each row execute function public.notify_auction_close();

-- --------------------------------------------------------------------------
-- 17. Filtros guardados
-- --------------------------------------------------------------------------
create table if not exists public.saved_filters (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  filters    jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  unique (profile_id, name)
);

alter table public.saved_filters enable row level security;

drop policy if exists saved_filters_owner on public.saved_filters;
create policy saved_filters_owner on public.saved_filters
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
