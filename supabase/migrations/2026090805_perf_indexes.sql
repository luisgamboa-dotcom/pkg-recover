-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 5: índices sobre FKs restantes
-- Cubre el advisor unindexed_foreign_keys (joins + chequeos de integridad).
-- ============================================================================

create index if not exists inventory_movements_created_by_idx
  on public.inventory_movements (created_by);
create index if not exists inventory_movements_warehouse_id_idx
  on public.inventory_movements (warehouse_id);
create index if not exists lots_package_id_idx
  on public.lots (package_id);
create index if not exists messages_receiver_id_idx
  on public.messages (receiver_id);
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);
create index if not exists notifications_lot_id_idx
  on public.notifications (lot_id);
create index if not exists notifications_order_id_idx
  on public.notifications (order_id);
create index if not exists orders_payment_method_id_idx
  on public.orders (payment_method_id);
create index if not exists orders_shipping_address_id_idx
  on public.orders (shipping_address_id);
create index if not exists reviews_order_id_idx
  on public.reviews (order_id);
create index if not exists shipments_origin_warehouse_id_idx
  on public.shipments (origin_warehouse_id);
create index if not exists support_tickets_order_id_idx
  on public.support_tickets (order_id);
create index if not exists ticket_messages_sender_id_idx
  on public.ticket_messages (sender_id);
