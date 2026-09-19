-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 8: automatización Fase 1
-- 1) log_sale_movement: cada venta queda en el historial de inventario (§16).
-- 2) Notificaciones automáticas por evento, SIEMPRE respetando
--    notification_preferences del usuario (ofertas, novedades, pedidos,
--    despachos, disponibilidad). Funciones DEFINER: los eventos los pueden
--    disparar compradores sin permiso de escritura en esas tablas.
-- ============================================================================

-- Etiquetas en español para los avisos.
create or replace function public.status_es(s text)
returns text language sql immutable set search_path = public as $$
  select case s
    when 'pending_payment' then 'pendiente de pago'
    when 'paid' then 'pagado'
    when 'preparing' then 'en preparación'
    when 'shipped' then 'enviado'
    when 'delivered' then 'entregado'
    when 'cancelled' then 'cancelado'
    when 'returned' then 'devuelto'
    when 'pending' then 'pendiente'
    when 'picked_up' then 'recogido'
    when 'in_transit' then 'en tránsito'
    when 'out_for_delivery' then 'en reparto'
    when 'failed' then 'fallido'
    else coalesce(s, '')
  end
$$;

-- 1) Historial de inventario en cada venta.
create or replace function public.log_sale_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_number text;
  v_warehouse uuid;
  v_buyer uuid;
begin
  select o.order_number, l.warehouse_id, o.buyer_id
    into v_number, v_warehouse, v_buyer
    from public.orders o
    join public.lots l on l.id = new.lot_id
   where o.id = new.order_id;
  insert into public.inventory_movements
    (lot_id, warehouse_id, movement_type, quantity, reference, created_by)
  values
    (new.lot_id, v_warehouse, 'sale', new.quantity, v_number, v_buyer);
  return new;
end $$;

drop trigger if exists trg_order_items_log_sale on public.order_items;
create trigger trg_order_items_log_sale
  after insert on public.order_items
  for each row execute function public.log_sale_movement();

-- 2a) Cambio de estado del pedido → aviso al comprador (order_updates).
create or replace function public.notify_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.notifications (profile_id, type, title, body, order_id)
    select new.buyer_id, 'order_update',
           'Tu pedido ' || new.order_number || ' está ' || public.status_es(new.status),
           'Revisa el detalle y el seguimiento del despacho.',
           new.id
      from public.notification_preferences p
     where p.profile_id = new.buyer_id
       and p.order_updates;
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify
  after update of status on public.orders
  for each row execute function public.notify_order_status();

-- 2b) Nuevo despacho o cambio de su estado → aviso (shipping_updates).
create or replace function public.notify_shipment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_buyer uuid;
  v_number text;
begin
  select o.buyer_id, o.order_number into v_buyer, v_number
    from public.orders o where o.id = new.order_id;
  insert into public.notifications (profile_id, type, title, body, order_id)
  select v_buyer, 'shipping_update',
         'Despacho ' || public.status_es(new.status) || ' · ' || v_number,
         'Transportadora ' || new.carrier ||
           coalesce(' · Guía ' || new.tracking_number, '') || '.',
         new.order_id
    from public.notification_preferences p
   where p.profile_id = v_buyer
     and p.shipping_updates;
  return new;
end $$;

drop trigger if exists trg_shipments_notify on public.shipments;
create trigger trg_shipments_notify
  after insert or update of status on public.shipments
  for each row execute function public.notify_shipment();

-- 2c) Lote publicado → aviso a interesados en novedades (new_lots).
create or replace function public.notify_new_lot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (profile_id, type, title, body, lot_id)
  select p.profile_id, 'new_lot',
         'Nuevo lote: ' || new.title,
         left(coalesce(new.description, 'Lote verificado disponible.'), 200),
         new.id
    from public.notification_preferences p
   where p.new_lots;
  return new;
end $$;

drop trigger if exists trg_lots_notify on public.lots;
create trigger trg_lots_notify
  after update of status on public.lots
  for each row
  when (old.status is distinct from new.status and new.status = 'published')
  execute function public.notify_new_lot();

-- 2d) Lote vinculado a promoción activa → aviso de oferta (offers).
create or replace function public.notify_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_promo text;
  v_lot text;
  v_pct numeric;
  v_active boolean;
begin
  select pr.title, l.title, pr.discount_percent, pr.is_active
    into v_promo, v_lot, v_pct, v_active
    from public.promotions pr
    join public.lots l on l.id = new.lot_id
   where pr.id = new.promotion_id;
  if coalesce(v_active, false) then
    insert into public.notifications (profile_id, type, title, body, lot_id)
    select p.profile_id, 'offer',
           'Oferta: ' || v_promo,
           v_lot || ' con ' || v_pct || '% de descuento.',
           new.lot_id
      from public.notification_preferences p
     where p.offers;
  end if;
  return new;
end $$;

drop trigger if exists trg_promotion_lots_notify on public.promotion_lots;
create trigger trg_promotion_lots_notify
  after insert on public.promotion_lots
  for each row execute function public.notify_promotion();

-- 2e) Stock 0 → >0 → aviso a quienes lo tienen en favoritos (availability).
create or replace function public.notify_back_in_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (profile_id, type, title, body, lot_id)
  select f.profile_id, 'availability',
         'Disponible de nuevo: ' || new.title,
         'Uno de tus favoritos volvió a tener stock.',
         new.id
    from public.favorites f
    join public.notification_preferences p on p.profile_id = f.profile_id
   where f.lot_id = new.id
     and p.availability;
  return new;
end $$;

drop trigger if exists trg_lots_back_in_stock on public.lots;
create trigger trg_lots_back_in_stock
  after update of stock_quantity on public.lots
  for each row
  when (old.stock_quantity = 0 and new.stock_quantity > 0)
  execute function public.notify_back_in_stock();
