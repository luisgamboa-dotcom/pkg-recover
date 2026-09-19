-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 9: pagos y flete dinámico (Fase 2)
-- payments: intentos de cobro por pasarela (los crean SOLO las Edge Functions
-- con service_role; sin políticas de escritura para clientes). Lectura:
-- comprador ve los suyos, admin todo.
-- shipping_rates: matriz ciudad-destino × tramo de peso → tarifa CLP.
-- ============================================================================

create table public.payments (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders (id) on delete cascade,
  provider    text        not null default 'mercadopago'
              check (provider in ('mercadopago','webpay','manual')),
  external_id text        unique,                      -- id de la preferencia/pago
  status      text        not null default 'pending'
              check (status in ('pending','approved','rejected','cancelled','refunded')),
  amount      numeric(12,2) not null check (amount >= 0),
  currency    char(3)     not null default 'CLP' check (currency in ('CLP','USD')),
  raw         jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index payments_order_id_idx on public.payments (order_id);
create index payments_external_id_idx on public.payments (external_id);

create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy payments_buyer_read on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.buyer_id = auth.uid()
    )
  );
create policy payments_admin_all on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Tarifas de flete por ciudad destino y tramo de peso (CLP).
-- --------------------------------------------------------------------------
create table public.shipping_rates (
  id               uuid        primary key default gen_random_uuid(),
  warehouse_id     uuid        references public.warehouses (id) on delete set null,
  dest_city        text        not null,                  -- 'Otra' = resto del país
  min_weight_kg    numeric(10,2) not null default 0 check (min_weight_kg >= 0),
  max_weight_kg    numeric(10,2),                          -- null = sin tope
  is_active        boolean     not null default true,
  price            numeric(12,2) not null check (price >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (max_weight_kg is null or max_weight_kg > min_weight_kg)
);
create index shipping_rates_lookup_idx
  on public.shipping_rates (dest_city, min_weight_kg);

create trigger trg_shipping_rates_updated_at before update on public.shipping_rates
  for each row execute function public.set_updated_at();

alter table public.shipping_rates enable row level security;

create policy shipping_rates_read on public.shipping_rates
  for select using (is_active = true or public.is_admin());
create policy shipping_rates_admin_all on public.shipping_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed: matriz de referencia CLP (origen SCL-01).
insert into public.shipping_rates (warehouse_id, dest_city, min_weight_kg, max_weight_kg, price)
select w.id, r.dest_city, r.min_w, r.max_w, r.price
  from public.warehouses w
  cross join (values
    ('Santiago',    0,   30,  4990),
    ('Santiago',   30,  200, 12990),
    ('Santiago',  200, 1000, 34990),
    ('Santiago', 1000, null, 59990),
    ('Valparaíso',  0,   30,  5990),
    ('Valparaíso', 30,  200, 14990),
    ('Valparaíso',200, 1000, 38990),
    ('Valparaíso',1000,null, 64990),
    ('Concepción',  0,   30,  6990),
    ('Concepción', 30,  200, 16990),
    ('Concepción',200, 1000, 42990),
    ('Concepción',1000,null, 69990),
    ('La Serena',   0,   30,  7490),
    ('La Serena',  30,  200, 17990),
    ('La Serena', 200, 1000, 44990),
    ('La Serena',1000, null, 74990),
    ('Otra',        0,   30,  8990),
    ('Otra',       30,  200, 19990),
    ('Otra',      200, 1000, 49990),
    ('Otra',     1000, null, 79990)
  ) as r(dest_city, min_w, max_w, price)
 where w.code = 'SCL-01'
on conflict do nothing;
