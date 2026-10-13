-- ============================================================================
-- Migración 19: post-compra — Fase C (11, 12, 13)
-- - 11: v_tracking_public: seguimiento público por código (sin login).
-- - 12: retiro en bodega: fulfillment + pickup_warehouse_id + pickup_code.
-- - 13: returns: devoluciones con aviso al comprador.
-- Aplicar en Supabase (Dashboard → SQL o CLI: supabase db push).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 12. Retiro en bodega
-- --------------------------------------------------------------------------
alter table public.orders
  add column if not exists fulfillment text not null default 'delivery'
  check (fulfillment in ('delivery','pickup'));

alter table public.orders
  add column if not exists pickup_warehouse_id uuid
  references public.warehouses (id) on delete set null;

alter table public.orders
  add column if not exists pickup_code text unique;

create or replace function public.gen_pickup_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_code text;
begin
  if new.fulfillment = 'pickup' and new.pickup_code is null then
    loop
      v_code := 'RP-R-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.orders o where o.pickup_code = v_code);
    end loop;
    new.pickup_code := v_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_pickup_code on public.orders;
create trigger trg_orders_pickup_code
  before insert or update of fulfillment on public.orders
  for each row execute function public.gen_pickup_code();

-- --------------------------------------------------------------------------
-- 13. Devoluciones
-- --------------------------------------------------------------------------
create table if not exists public.returns (
  id            uuid        primary key default gen_random_uuid(),
  order_id      uuid        not null references public.orders (id) on delete cascade,
  order_item_id uuid        references public.order_items (id) on delete set null,
  buyer_id      uuid        not null references public.profiles (id) on delete cascade,
  reason        text        not null
                check (reason in ('damaged','wrong_item','not_as_described','changed_mind','other')),
  message       text,
  status        text        not null default 'requested'
                check (status in ('requested','approved','rejected','completed')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create index if not exists returns_order_idx on public.returns (order_id, status);

alter table public.returns enable row level security;

drop policy if exists returns_buyer on public.returns;
create policy returns_buyer on public.returns
  for all using (buyer_id = auth.uid() or public.is_admin())
  with check (buyer_id = auth.uid() or public.is_admin());

-- Decisión → aviso al comprador.
create or replace function public.notify_return_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
begin
  if old.status = 'requested' and new.status in ('approved','rejected','completed') then
    select o.order_number into v_number from public.orders o where o.id = new.order_id;
    insert into public.notifications (profile_id, type, title, body, order_id)
    select new.buyer_id, 'order_update',
           'Devolución ' ||
             case when new.status = 'approved' then 'aprobada'
                  when new.status = 'rejected' then 'rechazada'
                  else 'completada' end ||
             ' · ' || v_number,
           case when new.status = 'approved' then 'Coordinaremos el retiro o reembolso y te avisaremos.'
                when new.status = 'rejected' then 'Revisa el detalle o contáctanos por ayuda.'
                else 'Reembolso registrado. Gracias por comprar circular.' end,
           new.order_id
      from public.notification_preferences p
     where p.profile_id = new.buyer_id
       and p.order_updates;
    update public.returns set decided_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_returns_notify on public.returns;
create trigger trg_returns_notify
  after update of status on public.returns
  for each row execute function public.notify_return_decision();

-- --------------------------------------------------------------------------
-- 11. Seguimiento público por código de tracking
-- --------------------------------------------------------------------------
create or replace view public.v_tracking_public as
select s.tracking_number,
       s.status,
       s.carrier,
       s.estimated_at,
       s.delivered_at,
       o.order_number,
       o.created_at as ordered_at,
       (select json_agg(
                 json_build_object('status', e.status, 'location', e.location_text, 'at', e.event_at)
                 order by e.event_at)
          from public.shipment_events e
         where e.shipment_id = s.id) as events
  from public.shipments s
  join public.orders o on o.id = s.order_id
 where s.tracking_number is not null;

-- La conversión oferta→pedido se invoca por RPC: permiso explícito.
grant execute on function public.convert_offer_to_order(uuid) to authenticated;
