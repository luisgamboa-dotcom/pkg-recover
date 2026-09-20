-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 13: método de recepción de paquetes
-- Un único método habilitado: recepción directa por personal propio
-- ("Personal de pkg-recover"). Catálogo para futuros métodos.
-- ============================================================================

create table public.reception_methods (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null unique,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_reception_methods_updated_at before update on public.reception_methods
  for each row execute function public.set_updated_at();

alter table public.reception_methods enable row level security;

create policy reception_methods_read on public.reception_methods
  for select using (is_active = true or public.is_admin());
create policy reception_methods_admin_all on public.reception_methods
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.packages
  add column reception_method_id uuid references public.reception_methods (id) on delete restrict;

insert into public.reception_methods (code, name, description) values
  ('personal', 'Personal de pkg-recover',
   'Recepción directa realizada por personal propio de la plataforma.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

-- Tabla vacía al migrar: el método es obligatorio desde el día 0.
alter table public.packages
  alter column reception_method_id set not null;
