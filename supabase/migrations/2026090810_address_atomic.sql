-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 10: direcciones atómicas (1NF)
-- Ningún campo guarda más de un dato: calle, número, depto, comuna, ciudad,
-- región, postal y país van por separado, en addresses y en el snapshot de
-- orders. Tablas vacías al migrar: reemplazo directo sin backfill.
-- ============================================================================

-- Direcciones del comprador.
alter table public.addresses
  add column street_name text,
  add column street_number text,
  add column apartment text,
  add column commune text,
  add column region text,
  add column postal_code text,
  add column country text not null default 'Chile';

alter table public.addresses
  alter column street_name set not null,
  alter column street_number set not null,
  alter column commune set not null,
  alter column region set not null;

alter table public.addresses drop column address_line;

alter table public.addresses drop constraint if exists addresses_text_length;
alter table public.addresses add constraint addresses_text_length
  check (char_length(coalesce(label, '')) <= 60
     and char_length(recipient_name) <= 150
     and char_length(phone) <= 30
     and char_length(street_name) <= 150
     and char_length(street_number) <= 20
     and char_length(coalesce(apartment, '')) <= 60
     and char_length(commune) <= 100
     and char_length(city) <= 100
     and char_length(region) <= 60
     and char_length(coalesce(postal_code, '')) <= 10
     and char_length(country) <= 60
     and char_length(coalesce(delivery_notes, '')) <= 500);

-- Snapshot histórico del pedido.
alter table public.orders
  add column ship_street_name text,
  add column ship_street_number text,
  add column ship_apartment text,
  add column ship_commune text,
  add column ship_region text,
  add column ship_postal_code text,
  add column ship_country text not null default 'Chile';

alter table public.orders
  alter column ship_street_name set not null,
  alter column ship_street_number set not null,
  alter column ship_commune set not null,
  alter column ship_region set not null;

alter table public.orders drop column ship_address_line;

alter table public.orders drop constraint if exists orders_text_length;
alter table public.orders add constraint orders_text_length
  check (char_length(ship_recipient_name) <= 150
     and char_length(ship_phone) <= 30
     and char_length(ship_street_name) <= 150
     and char_length(ship_street_number) <= 20
     and char_length(coalesce(ship_apartment, '')) <= 60
     and char_length(ship_commune) <= 100
     and char_length(ship_city) <= 100
     and char_length(ship_region) <= 60
     and char_length(coalesce(ship_postal_code, '')) <= 10
     and char_length(ship_country) <= 60
     and char_length(coalesce(ship_notes, '')) <= 500
     and char_length(coalesce(carrier, '')) <= 100);
