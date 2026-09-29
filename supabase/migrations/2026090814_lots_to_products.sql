-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 14: lotes → productos
-- La unidad comercial se llama "producto" con la misma ficha técnica.
-- Tablas vacías de negocio: renombres directos sin backfill.
-- ============================================================================

-- ---------- Tablas ----------
alter table public.lots rename to products;
alter table public.lot_categories rename to product_categories;
alter table public.lot_images rename to product_images;
alter table public.lot_price_tiers rename to product_price_tiers;
alter table public.promotion_lots rename to promotion_products;

-- ---------- Columnas lot_id → product_id ----------
alter table public.product_categories rename column lot_id to product_id;
alter table public.product_images rename column lot_id to product_id;
alter table public.product_price_tiers rename column lot_id to product_id;
alter table public.order_items rename column lot_id to product_id;
alter table public.favorites rename column lot_id to product_id;
alter table public.reviews rename column lot_id to product_id;
alter table public.messages rename column lot_id to product_id;
alter table public.promotion_products rename column lot_id to product_id;
alter table public.notifications rename column lot_id to product_id;
alter table public.inventory_movements rename column lot_id to product_id;

-- ---------- Constraints ----------
alter table public.products rename constraint lots_pkey to products_pkey;
alter table public.products rename constraint lots_company_id_fkey to products_company_id_fkey;
alter table public.products rename constraint lots_warehouse_id_fkey to products_warehouse_id_fkey;
alter table public.products rename constraint lots_brand_id_fkey to products_brand_id_fkey;
alter table public.products rename constraint lots_package_id_fkey to products_package_id_fkey;
alter table public.products rename constraint lots_text_length to products_text_length;
alter table public.product_categories rename constraint lot_categories_pkey to product_categories_pkey;
alter table public.product_categories rename constraint lot_categories_lot_id_fkey to product_categories_product_id_fkey;
alter table public.product_categories rename constraint lot_categories_category_id_fkey to product_categories_category_id_fkey;
alter table public.product_images rename constraint lot_images_lot_id_fkey to product_images_product_id_fkey;
alter table public.product_price_tiers rename constraint lot_price_tiers_lot_id_fkey to product_price_tiers_product_id_fkey;
alter table public.promotion_products rename constraint promotion_lots_pkey to promotion_products_pkey;
alter table public.promotion_products rename constraint promotion_lots_lot_id_fkey to promotion_products_product_id_fkey;
alter table public.promotion_products rename constraint promotion_lots_promotion_id_fkey to promotion_products_promotion_id_fkey;
alter table public.order_items rename constraint order_items_lot_id_fkey to order_items_product_id_fkey;
alter table public.favorites rename constraint favorites_lot_id_fkey to favorites_product_id_fkey;
alter table public.reviews rename constraint reviews_lot_id_fkey to reviews_product_id_fkey;
alter table public.messages rename constraint messages_lot_id_fkey to messages_product_id_fkey;
alter table public.notifications rename constraint notifications_lot_id_fkey to notifications_product_id_fkey;
alter table public.inventory_movements rename constraint inventory_movements_lot_id_fkey to inventory_movements_product_id_fkey;

-- ---------- Índices ----------
alter index public.lots_status_published_idx rename to products_status_published_idx;
alter index public.lots_company_id_idx rename to products_company_id_idx;
alter index public.lots_warehouse_id_idx rename to products_warehouse_id_idx;
alter index public.lots_brand_id_idx rename to products_brand_id_idx;
alter index public.lots_title_trgm_idx rename to products_title_trgm_idx;
alter index public.lots_package_id_idx rename to products_package_id_idx;
alter index public.lot_categories_category_id_idx rename to product_categories_category_id_idx;
alter index public.lot_images_lot_id_idx rename to product_images_lot_id_idx;
alter index public.lot_images_single_primary_uidx rename to product_images_single_primary_uidx;
alter index public.lot_price_tiers_lot_id_idx rename to product_price_tiers_lot_id_idx;
alter index public.promotion_lots_lot_id_idx rename to promotion_products_lot_id_idx;
alter index public.order_items_lot_id_idx rename to order_items_product_id_idx;
alter index public.favorites_lot_id_idx rename to favorites_product_id_idx;
alter index public.reviews_lot_id_idx rename to reviews_product_id_idx;
alter index public.inventory_movements_lot_id_idx rename to inventory_movements_product_id_idx;

-- ---------- Secuencia + función SKU ----------
alter sequence public.lot_sku_seq rename to product_sku_seq;
create or replace function public.assign_product_sku()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sku is null then
    new.sku := 'RP-' || lpad(nextval('product_sku_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_lots_assign_sku on public.products;
create trigger trg_products_assign_sku before insert on public.products
  for each row execute function public.assign_product_sku();
drop function if exists public.assign_lot_sku();

-- ---------- Triggers renombrados (misma función set_updated_at) ----------
alter trigger trg_lots_updated_at on public.products rename to trg_products_updated_at;
alter trigger trg_lots_notify on public.products rename to trg_products_notify;
alter trigger trg_lots_back_in_stock on public.products rename to trg_products_back_in_stock;
alter trigger trg_promotion_lots_notify on public.promotion_products rename to trg_promotion_products_notify;

-- ---------- Funciones con nombres literales de tabla ----------
drop function if exists public.apply_stock_delta(uuid, integer);
create function public.apply_stock_delta(p_product_id uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
begin
  if pg_trigger_depth() = 0 then
    raise exception 'Uso interno: solo vía trigger de order_items';
  end if;

  update public.products
     set stock_quantity = stock_quantity + p_delta
   where id = p_product_id
  returning stock_quantity into v_stock;

  if v_stock is null then
    raise exception 'Producto % no existe', p_product_id;
  end if;
  if v_stock < 0 then
    raise exception 'Stock insuficiente para el producto %', p_product_id;
  end if;

  update public.products
     set status = case when stock_quantity = 0 then 'sold_out'
                       when status = 'sold_out' then 'published'
                       else status end
   where id = p_product_id;
end $$;

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
    join public.products l on l.id = new.product_id
   where o.id = new.order_id;
  insert into public.inventory_movements
    (product_id, warehouse_id, movement_type, quantity, reference, created_by)
  values
    (new.product_id, v_warehouse, 'sale', new.quantity, v_number, v_buyer);
  return new;
end $$;

create or replace function public.notify_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_promo text;
  v_product text;
  v_pct numeric;
  v_active boolean;
begin
  select pr.title, l.title, pr.discount_percent, pr.is_active
    into v_promo, v_product, v_pct, v_active
    from public.promotions pr
    join public.products l on l.id = new.product_id
   where pr.id = new.promotion_id;
  if coalesce(v_active, false) then
    insert into public.notifications (profile_id, type, title, body, product_id)
    select p.profile_id, 'offer',
           'Oferta: ' || v_promo,
           v_product || ' con ' || v_pct || '% de descuento.',
           new.product_id
      from public.notification_preferences p
     where p.offers;
  end if;
  return new;
end $$;

create or replace function public.adjust_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_stock_delta(new.product_id, -new.quantity);
  elsif tg_op = 'DELETE' then
    perform public.apply_stock_delta(old.product_id, old.quantity);
  else
    if new.product_id = old.product_id then
      perform public.apply_stock_delta(new.product_id, old.quantity - new.quantity);
    else
      perform public.apply_stock_delta(old.product_id, old.quantity);
      perform public.apply_stock_delta(new.product_id, -new.quantity);
    end if;
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.notify_back_in_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (profile_id, type, title, body, product_id)
  select f.profile_id, 'availability',
         'Disponible de nuevo: ' || new.title,
         'Uno de tus favoritos volvió a tener stock.',
         new.id
    from public.favorites f
    join public.notification_preferences p on p.profile_id = f.profile_id
   where f.product_id = new.id
     and p.availability;
  return new;
end $$;

create or replace function public.order_has_company_product(p_order_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi
    join public.products l on l.id = oi.product_id
     where oi.order_id = p_order_id
       and l.company_id in (select public.my_company_ids())
  );
$$;

-- ---------- Vistas ----------
create or replace view public.v_inventory_summary
with (security_invoker = true) as
select l.id, l.sku, l.title, l.status, l.stock_quantity, l.base_price,
       (l.stock_quantity * l.base_price) as stock_value,
       l.unit_count, l.total_weight_kg,
       w.code as warehouse_code, w.city as warehouse_city,
       c.name as company_name,
       (select count(*) from public.inventory_movements m where m.product_id = l.id) as movements_count
  from public.products l
  left join public.warehouses w on w.id = l.warehouse_id
  left join public.companies c on c.id = l.company_id;

create or replace view public.v_company_recovery
with (security_invoker = true) as
select c.id as company_id, c.name as company_name,
       c.is_verified,
       (select count(*) from public.packages p where p.company_id = c.id) as packages_received,
       (select count(*) from public.products l
         where l.company_id = c.id and l.status = 'published') as lots_published,
       coalesce(sum(oi.line_total), 0) as revenue_recovered,
       coalesce(sum(oi.quantity), 0) as lots_sold
  from public.companies c
  left join public.products l on l.company_id = c.id
  left join public.order_items oi on oi.product_id = l.id
  left join public.orders o on o.id = oi.order_id
    and o.status not in ('cancelled','returned')
 group by c.id, c.name, c.is_verified;

drop view if exists public.v_best_selling_lots;
create view public.v_best_selling_products
with (security_invoker = true) as
select l.id, l.sku, l.title, l.base_price,
       coalesce(sum(oi.quantity), 0) as units_sold,
       coalesce(sum(oi.line_total), 0) as revenue,
       count(distinct o.id) as orders_count
  from public.products l
  left join public.order_items oi on oi.product_id = l.id
  left join public.orders o on o.id = oi.order_id
    and o.status not in ('cancelled','returned')
 group by l.id, l.sku, l.title, l.base_price
 order by revenue desc;

-- ---------- Políticas renombradas ----------
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or public.order_has_company_product(orders.id)
  );

drop function if exists public.order_has_company_lot(uuid);

drop trigger if exists trg_order_items_stock on public.order_items;
create trigger trg_order_items_stock
  after insert or update or delete on public.order_items
  for each row execute function public.adjust_product_stock();
drop function if exists public.adjust_lot_stock();

drop policy if exists lots_select on public.products;
create policy products_select on public.products
  for select using (
    (status = 'published' and stock_quantity > 0)
    or public.is_admin()
    or company_id in (select public.my_company_ids())
  );

drop policy if exists lots_admin_all on public.products;
create policy products_admin_all on public.products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists lot_categories_read on public.product_categories;
create policy product_categories_read on public.product_categories
  for select using (true);
drop policy if exists lot_categories_admin_all on public.product_categories;
create policy product_categories_admin_all on public.product_categories
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists lot_images_read on public.product_images;
create policy product_images_read on public.product_images
  for select using (true);
drop policy if exists lot_images_admin_all on public.product_images;
create policy product_images_admin_all on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists lot_price_tiers_read on public.product_price_tiers;
create policy product_price_tiers_read on public.product_price_tiers
  for select using (true);
drop policy if exists lot_price_tiers_admin_all on public.product_price_tiers;
create policy product_price_tiers_admin_all on public.product_price_tiers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists promotion_lots_read on public.promotion_products;
create policy promotion_products_read on public.promotion_products
  for select using (true);
drop policy if exists promotion_lots_admin_all on public.promotion_products;
create policy promotion_products_admin_all on public.promotion_products
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or public.is_order_buyer(order_items.order_id)
    or exists (
      select 1 from public.products l
      where l.id = order_items.product_id
        and l.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    public.is_admin()
    or public.is_order_buyer(order_items.order_id)
  );

drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shipments_select on public.shipments;
create policy shipments_select on public.shipments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = shipments.order_id and o.buyer_id = auth.uid()
    )
    or exists (
      select 1 from public.order_items oi
      join public.products l on l.id = oi.product_id
      where oi.order_id = shipments.order_id
        and l.company_id in (select public.my_company_ids())
    )
  );

-- ---------- Storage: bucket product-images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists lot_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');
drop policy if exists lot_images_admin_write on storage.objects;
create policy product_images_admin_write on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists lot_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists lot_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

-- NOTA: el bucket vacío 'lot-images' no se puede borrar por SQL (protección
-- de Storage); eliminar manual desde Dashboard → Storage si se desea.

-- ---------- Seed: lote → producto en FAQs ----------
update public.faqs
   set question = replace(replace(question, 'lotes', 'productos'), 'lote', 'producto'),
       answer = replace(replace(answer, 'lotes', 'productos'), 'lote', 'producto');
