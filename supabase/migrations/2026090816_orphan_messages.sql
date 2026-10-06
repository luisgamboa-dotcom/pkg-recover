-- ============================================================================
-- Migración 16: mensajes huérfanos (producto sin proveedor)
-- Requerimiento: todos los productos deben tener proveedor (se exige en la
-- app al crear/editar). Si la empresa proveedora se elimina, el producto
-- sobrevive (company_id ON DELETE SET NULL) y las consultas desde la ficha
-- del producto se guardan SIN destinatario (receiver_id NULL) para que
-- administración las vea con la etiqueta especial "Sin destinatario".
-- Aplicar en Supabase (Dashboard → SQL o CLI: supabase db push) ANTES de
-- desplegar el frontend que envía receiver_id NULL.
-- ============================================================================

-- 1. Permitir mensajes sin destinatario.
alter table public.messages
  alter column receiver_id drop not null;

-- 2. Reemplazar el check sender <> receiver por uno que admita NULL.
--    (El nombre del check inline varía; se elimina por definición.)
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and pg_get_constraintdef(oid) like '%sender_id%receiver_id%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.messages
  add constraint messages_sender_receiver_check
  check (receiver_id is null or sender_id <> receiver_id);

-- 3. Índice para la bandeja de huérfanos del panel admin.
create index if not exists messages_orphan_idx
  on public.messages (product_id, created_at desc)
  where receiver_id is null;

-- 4. RLS: las políticas existentes ya cubren el flujo —
--    messages_select (sender, receiver o is_admin) y messages_insert
--    (sender_id = auth.uid()) funcionan con receiver_id NULL sin cambios.
