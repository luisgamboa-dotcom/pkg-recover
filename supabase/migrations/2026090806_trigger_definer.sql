-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 6: triggers internos como DEFINER
-- recalc_order_totals y apply_stock_delta escriben en orders/lots cuando un
-- comprador inserta order_items. Como el comprador no tiene UPDATE sobre esas
-- tablas (RLS correcto), los triggers fallarían con 42501 y tumbarían la
-- compra. Al ser DEFINER corren con el dueño y solo tocan la orden/lote del
-- cambio que los disparó. search_path queda fijo (migración 4).
-- ============================================================================

alter function public.recalc_order_totals() security definer;
alter function public.recalc_order_totals() set search_path = public;
alter function public.apply_stock_delta(uuid, integer) security definer;
alter function public.apply_stock_delta(uuid, integer) set search_path = public;
alter function public.adjust_lot_stock() security definer;
alter function public.adjust_lot_stock() set search_path = public;
