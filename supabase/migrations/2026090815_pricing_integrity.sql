-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 15: integridad de precios (auditoría)
-- 1) El flete y el IVA se recalculan en servidor: un comprador malicioso ya
--    no puede abaratar su pedido enviando shipping_cost/tax_amount en 0.
-- 2) is_verified_purchase se determina en servidor (compra real no
--    cancelada/devuelta), ignorando lo que envíe el cliente.
-- 3) Una sola dirección principal por usuario (índice parcial único).
-- 4) search_path fijo en las funciones de códigos restantes.
-- ============================================================================

-- Cotización espejo del frontend (misma matriz y fallback).
create or replace function public.quote_shipping_rate(p_city text, p_kg numeric)
returns numeric language sql stable set search_path = public as $$
  select coalesce(
    (select r.price from public.shipping_rates r
      where r.is_active and r.dest_city = p_city
        and r.min_weight_kg <= greatest(coalesce(p_kg, 0), 0)
        and (r.max_weight_kg is null or greatest(coalesce(p_kg, 0), 0) <= r.max_weight_kg)
      order by r.min_weight_kg desc limit 1),
    (select r.price from public.shipping_rates r
      where r.is_active and r.dest_city = 'Otra'
        and r.min_weight_kg <= greatest(coalesce(p_kg, 0), 0)
        and (r.max_weight_kg is null or greatest(coalesce(p_kg, 0), 0) <= r.max_weight_kg)
      order by r.min_weight_kg desc limit 1),
    45000
  );
$$;

create or replace function public.recalc_order_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2);
  v_city text;
  v_kg numeric(12,2);
  v_ship numeric(12,2);
  v_tax numeric(12,2);
begin
  v_order_id := coalesce(new.order_id, old.order_id);
  select coalesce(sum(line_total), 0) into v_subtotal
    from public.order_items where order_id = v_order_id;
  select o.ship_city into v_city from public.orders o where o.id = v_order_id;
  select coalesce(sum(l.total_weight_kg * oi.quantity), 0) into v_kg
    from public.order_items oi
    join public.products l on l.id = oi.product_id
   where oi.order_id = v_order_id;
  v_ship := public.quote_shipping_rate(v_city, v_kg);
  v_tax := round((v_subtotal + v_ship) * 0.19);
  update public.orders o
     set subtotal = v_subtotal,
         shipping_cost = v_ship,
         tax_amount = v_tax,
         total = v_subtotal + v_ship + v_tax
   where o.id = v_order_id;
  return coalesce(new, old);
end $$;

-- Reseña verificada solo con compra real (no cancelada/devuelta).
create or replace function public.enforce_verified_review()
returns trigger language plpgsql set search_path = public as $$
begin
  new.is_verified_purchase :=
    exists (
      select 1 from public.orders o
      join public.order_items oi on oi.order_id = o.id
     where o.buyer_id = new.profile_id
       and oi.product_id = new.product_id
       and o.status not in ('cancelled', 'returned')
    );
  return new;
end $$;

drop trigger if exists trg_reviews_verified on public.reviews;
create trigger trg_reviews_verified
  before insert or update of profile_id, product_id on public.reviews
  for each row execute function public.enforce_verified_review();

create unique index if not exists addresses_single_default_uidx
  on public.addresses (profile_id) where is_default;

alter function public.assign_order_number() set search_path = public;
alter function public.assign_ticket_number() set search_path = public;
