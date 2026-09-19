-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 11: rompe recursión orders↔order_items
-- orders_select consultaba order_items y order_items_select consultaba orders:
-- al insertar el detalle (checkout con cualquier método) Postgres entraba en
-- "infinite recursion detected in policy for relation orders".
-- Los helpers DEFINER evalúan sin RLS y cortan el ciclo. Semántica idéntica.
-- ============================================================================

create or replace function public.is_order_buyer(p_order_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id and o.buyer_id = auth.uid()
  );
$$;

create or replace function public.order_has_company_lot(p_order_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi
    join public.lots l on l.id = oi.lot_id
     where oi.order_id = p_order_id
       and l.company_id in (select public.my_company_ids())
  );
$$;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or public.order_has_company_lot(orders.id)
  );

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or public.is_order_buyer(order_items.order_id)
    or exists (
      select 1 from public.lots l
      where l.id = order_items.lot_id
        and l.company_id in (select public.my_company_ids())
    )
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (
    public.is_admin()
    or public.is_order_buyer(order_items.order_id)
  );