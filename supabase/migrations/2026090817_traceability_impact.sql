-- ============================================================================
-- Migración 17: trazabilidad pública + impacto circular (Fase A)
-- - product_timeline: etapas visibles en la ficha del producto.
-- - impact_factors: factores estimativos para CO2 evitado.
-- - v_company_public: ficha pública de empresas verificadas (solo columnas
--   no sensibles; las políticas de companies restringen a admin/miembros).
-- Aplicar en Supabase (Dashboard → SQL o CLI: supabase db push).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Línea de tiempo del producto
-- --------------------------------------------------------------------------
create table if not exists public.product_timeline (
  id          uuid        primary key default gen_random_uuid(),
  product_id  uuid        not null references public.products (id) on delete cascade,
  stage       text        not null check (stage in ('registrado','recibido','clasificado','verificado','publicado','vendido')),
  detail      text,
  actor_label text,
  created_at  timestamptz not null default now()
);

create index if not exists product_timeline_product_idx
  on public.product_timeline (product_id, created_at);

alter table public.product_timeline enable row level security;

drop policy if exists product_timeline_select on public.product_timeline;
create policy product_timeline_select on public.product_timeline
  for select using (true);

drop policy if exists product_timeline_admin_all on public.product_timeline;
create policy product_timeline_admin_all on public.product_timeline
  for all using (public.is_admin()) with check (public.is_admin());

-- Registro automático: alta + publicación + verificación.
create or replace function public.log_product_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.product_timeline (product_id, stage, detail)
    values (new.id, 'registrado', 'Producto registrado en el sistema.');
    if new.status = 'published' then
      insert into public.product_timeline (product_id, stage, detail)
      values (new.id, 'publicado', 'Producto publicado en el catálogo.');
    end if;
    if new.is_verified then
      insert into public.product_timeline (product_id, stage, detail)
      values (new.id, 'verificado', 'Estado verificado por el equipo RecuperaPack.');
    end if;
    return new;
  end if;
  if (tg_op = 'UPDATE') then
    if old.status is distinct from new.status and new.status = 'published' then
      insert into public.product_timeline (product_id, stage, detail)
      values (new.id, 'publicado', 'Producto publicado en el catálogo.');
    end if;
    if (not old.is_verified) and new.is_verified then
      insert into public.product_timeline (product_id, stage, detail)
      values (new.id, 'verificado', 'Estado verificado por el equipo RecuperaPack.');
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_product_timeline on public.products;
create trigger trg_log_product_timeline
  after insert or update of status, is_verified on public.products
  for each row execute function public.log_product_timeline();

-- Relleno inicial para productos existentes (etapas coherentes con su estado).
insert into public.product_timeline (product_id, stage, detail, created_at)
select p.id, 'registrado', 'Producto registrado en el sistema.',
       coalesce(p.published_at, p.created_at, now())
  from public.products p
  where not exists (select 1 from public.product_timeline t where t.product_id = p.id);

insert into public.product_timeline (product_id, stage, detail, created_at)
select p.id, 'verificado', 'Estado verificado por el equipo RecuperaPack.',
       coalesce(p.published_at, p.created_at, now())
  from public.products p
  where p.is_verified
    and not exists (select 1 from public.product_timeline t where t.product_id = p.id and t.stage = 'verificado');

insert into public.product_timeline (product_id, stage, detail, created_at)
select p.id, 'publicado', 'Producto publicado en el catálogo.',
       coalesce(p.published_at, p.created_at, now())
  from public.products p
  where p.status = 'published'
    and not exists (select 1 from public.product_timeline t where t.product_id = p.id and t.stage = 'publicado');

-- --------------------------------------------------------------------------
-- 2. Factores de impacto (valores estimativos, ajustables por admin)
-- --------------------------------------------------------------------------
create table if not exists public.impact_factors (
  key         text        primary key,
  value       numeric     not null check (value >= 0),
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.impact_factors (key, value, description)
values ('co2_kg_per_waste_kg', 2.0, 'Factor estimativo: kg de CO2e evitados por cada kg de desecho recirculado. Ajustable.')
on conflict (key) do nothing;

alter table public.impact_factors enable row level security;

drop policy if exists impact_factors_select on public.impact_factors;
create policy impact_factors_select on public.impact_factors
  for select using (true);

drop policy if exists impact_factors_admin_all on public.impact_factors;
create policy impact_factors_admin_all on public.impact_factors
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
-- 3. Ficha pública de empresas verificadas (sin datos de contacto)
-- --------------------------------------------------------------------------
create or replace view public.v_company_public as
select c.id, c.name, c.city, c.is_verified,
       (select count(*) from public.packages p where p.company_id = c.id) as packages_received,
       (select count(*) from public.products l where l.company_id = c.id and l.status = 'published') as products_published,
       coalesce((
         select sum(oi.quantity)
           from public.order_items oi
           join public.products l on l.id = oi.product_id
           join public.orders o on o.id = oi.order_id
          where l.company_id = c.id
            and o.status not in ('cancelled', 'returned')
       ), 0) as units_sold
  from public.companies c
 where c.is_verified = true;
