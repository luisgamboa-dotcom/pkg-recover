-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 2: RLS + Storage
-- Roles: customer / reseller / company / admin (prompt §24).
-- Cliente no ve ni toca datos ajenos; admin gestiona; empresa solo lo suyo.
-- ============================================================================

alter table public.roles                    enable row level security;
alter table public.profiles                 enable row level security;
alter table public.companies                enable row level security;
alter table public.company_members          enable row level security;
alter table public.warehouses               enable row level security;
alter table public.categories               enable row level security;
alter table public.brands                    enable row level security;
alter table public.packages                 enable row level security;
alter table public.lots                     enable row level security;
alter table public.lot_categories           enable row level security;
alter table public.lot_images               enable row level security;
alter table public.lot_price_tiers          enable row level security;
alter table public.inventory_movements      enable row level security;
alter table public.payment_methods          enable row level security;
alter table public.addresses                enable row level security;
alter table public.orders                   enable row level security;
alter table public.order_items              enable row level security;
alter table public.shipments                enable row level security;
alter table public.shipment_events          enable row level security;
alter table public.favorites                enable row level security;
alter table public.reviews                  enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.support_tickets          enable row level security;
alter table public.ticket_messages          enable row level security;
alter table public.messages                 enable row level security;
alter table public.promotions               enable row level security;
alter table public.promotion_lots           enable row level security;
alter table public.faqs                     enable row level security;

-- --------------------------------------------------------------------------
-- Helpers SECURITY DEFINER (evitan recursión de RLS sobre profiles)
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.code = 'admin'
  );
$$;

create or replace function public.own_role_id()
returns uuid language sql security definer set search_path = public as $$
  select p.role_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.my_company_ids()
returns setof uuid language sql security definer set search_path = public as $$
  select cm.company_id from public.company_members cm where cm.profile_id = auth.uid();
$$;

-- --------------------------------------------------------------------------
-- Catálogos públicos de tienda (sin datos sensibles)
-- --------------------------------------------------------------------------
create policy roles_read_all on public.roles
  for select using (true);

create policy categories_read_all on public.categories
  for select using (true);
create policy categories_admin_all on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy brands_read_all on public.brands
  for select using (true);
create policy brands_admin_all on public.brands
  for all using (public.is_admin()) with check (public.is_admin());

create policy payment_methods_read_all on public.payment_methods
  for select using (true);
create policy payment_methods_admin_all on public.payment_methods
  for all using (public.is_admin()) with check (public.is_admin());

create policy warehouses_read_all on public.warehouses
  for select using (true);
create policy warehouses_admin_all on public.warehouses
  for all using (public.is_admin()) with check (public.is_admin());

create policy faqs_read_active on public.faqs
  for select using (is_active = true or public.is_admin());
create policy faqs_admin_all on public.faqs
  for all using (public.is_admin()) with check (public.is_admin());

create policy promotions_read_active on public.promotions
  for select using (is_active = true or public.is_admin());
create policy promotions_admin_all on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());

create policy promotion_lots_read on public.promotion_lots
  for select using (true);
create policy promotion_lots_admin_all on public.promotion_lots
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Perfiles: cada uno lo suyo; admin todo. El rol solo lo cambia admin.
-- --------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and (public.is_admin() or role_id = public.own_role_id()))
    or public.is_admin()
  );

-- --------------------------------------------------------------------------
-- Lotes: vitrina pública = publicados con stock; empresa ve los suyos.
-- Escritura solo admin (convierte lo procesado en publicación, prompt §17).
-- --------------------------------------------------------------------------
create policy lots_select on public.lots
  for select using (
    (status = 'published' and stock_quantity > 0)
    or public.is_admin()
    or company_id in (select public.my_company_ids())
  );

create policy lots_admin_all on public.lots
  for all using (public.is_admin()) with check (public.is_admin());

create policy lot_categories_read on public.lot_categories
  for select using (true);
create policy lot_categories_admin_all on public.lot_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy lot_images_read on public.lot_images
  for select using (true);
create policy lot_images_admin_all on public.lot_images
  for all using (public.is_admin()) with check (public.is_admin());

create policy lot_price_tiers_read on public.lot_price_tiers
  for select using (true);
create policy lot_price_tiers_admin_all on public.lot_price_tiers
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Paquetes e inventario: admin gestiona; empresa registra/ve los suyos.
-- --------------------------------------------------------------------------
create policy packages_select on public.packages
  for select using (
    public.is_admin() or company_id in (select public.my_company_ids())
  );

create policy packages_insert on public.packages
  for insert with check (
    public.is_admin() or company_id in (select public.my_company_ids())
  );

create policy packages_update on public.packages
  for update using (
    public.is_admin() or company_id in (select public.my_company_ids())
  ) with check (
    public.is_admin() or company_id in (select public.my_company_ids())
  );

create policy packages_admin_delete on public.packages
  for delete using (public.is_admin());

create policy inventory_select on public.inventory_movements
  for select using (public.is_admin());
create policy inventory_insert_admin on public.inventory_movements
  for insert with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Empresas y miembros
-- --------------------------------------------------------------------------
create policy companies_select on public.companies
  for select using (
    public.is_admin() or id in (select public.my_company_ids())
  );
create policy companies_admin_all on public.companies
  for all using (public.is_admin()) with check (public.is_admin());

create policy company_members_select on public.company_members
  for select using (
    public.is_admin()
    or profile_id = auth.uid()
    or company_id in (select public.my_company_ids())
  );
create policy company_members_admin_all on public.company_members
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Direcciones: solo el dueño
-- --------------------------------------------------------------------------
create policy addresses_owner_all on public.addresses
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy addresses_admin_read on public.addresses
  for select using (public.is_admin());

-- --------------------------------------------------------------------------
-- Pedidos: comprador (sus pedidos), empresa (pedidos con sus lotes), admin.
-- El comprador crea su pedido; no edita totales/estado (lo hace el trigger
-- de detalle + admin). Sin UPDATE para comprador a propósito.
-- --------------------------------------------------------------------------
create policy orders_select on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.order_items oi
      join public.lots l on l.id = oi.lot_id
      where oi.order_id = orders.id
        and l.company_id in (select public.my_company_ids())
    )
  );

create policy orders_insert_own on public.orders
  for insert with check (buyer_id = auth.uid());

create policy orders_admin_all on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = auth.uid()
    )
    or exists (
      select 1 from public.lots l
      where l.id = order_items.lot_id
        and l.company_id in (select public.my_company_ids())
    )
  );

create policy order_items_insert on public.order_items
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = auth.uid()
    )
  );

create policy order_items_admin_all on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Despachos: comprador del pedido, empresa involucrada, admin
-- --------------------------------------------------------------------------
create policy shipments_select on public.shipments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = shipments.order_id and o.buyer_id = auth.uid()
    )
    or exists (
      select 1 from public.order_items oi
      join public.lots l on l.id = oi.lot_id
      where oi.order_id = shipments.order_id
        and l.company_id in (select public.my_company_ids())
    )
  );

create policy shipments_admin_all on public.shipments
  for all using (public.is_admin()) with check (public.is_admin());

create policy shipment_events_select on public.shipment_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_events.shipment_id and o.buyer_id = auth.uid()
    )
  );

create policy shipment_events_admin_all on public.shipment_events
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- Favoritos, reseñas, notificaciones: dueño; reseñas visibles públicas
-- --------------------------------------------------------------------------
create policy favorites_owner_all on public.favorites
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy reviews_read on public.reviews
  for select using (is_visible = true or profile_id = auth.uid() or public.is_admin());
create policy reviews_insert_own on public.reviews
  for insert with check (profile_id = auth.uid());
create policy reviews_update_own on public.reviews
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());
create policy reviews_admin_delete on public.reviews
  for delete using (public.is_admin());

create policy notifications_owner on public.notifications
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notifications_admin_all on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

create policy notification_prefs_owner_all on public.notification_preferences
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- --------------------------------------------------------------------------
-- Soporte y mensajería: participantes + admin
-- --------------------------------------------------------------------------
create policy tickets_owner on public.support_tickets
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy tickets_admin_all on public.support_tickets
  for all using (public.is_admin()) with check (public.is_admin());

create policy ticket_messages_select on public.ticket_messages
  for select using (
    public.is_admin()
    or sender_id = auth.uid()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id and t.profile_id = auth.uid()
    )
  );
create policy ticket_messages_insert on public.ticket_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_messages.ticket_id and t.profile_id = auth.uid()
      )
    )
  );

create policy messages_select on public.messages
  for select using (
    sender_id = auth.uid() or receiver_id = auth.uid() or public.is_admin()
  );
create policy messages_insert on public.messages
  for insert with check (sender_id = auth.uid());

-- ============================================================================
-- Storage (prompt §17): referencias en BD, binarios en buckets
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('lot-images', 'lot-images', true),
       ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy lot_images_public_read on storage.objects
  for select using (bucket_id = 'lot-images');
create policy lot_images_admin_write on storage.objects
  for insert with check (bucket_id = 'lot-images' and public.is_admin());
create policy lot_images_admin_update on storage.objects
  for update using (bucket_id = 'lot-images' and public.is_admin())
  with check (bucket_id = 'lot-images' and public.is_admin());
create policy lot_images_admin_delete on storage.objects
  for delete using (bucket_id = 'lot-images' and public.is_admin());

create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');
create policy avatars_owner_write on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_owner_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_admin_all on storage.objects
  for all using (bucket_id = 'avatars' and public.is_admin())
  with check (bucket_id = 'avatars' and public.is_admin());
