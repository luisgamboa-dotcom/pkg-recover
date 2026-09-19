-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 4: hardening post-advisors
-- Fija search_path en funciones trigger (advisor function_search_path_mutable).
-- Evita que un search_path manipulado por sesión cambie la resolución de
-- objetos dentro de las funciones. No altera su lógica.
-- ============================================================================

alter function public.set_updated_at()          set search_path = public;
alter function public.assign_order_number()     set search_path = public;
alter function public.assign_lot_sku()          set search_path = public;
alter function public.assign_ticket_number()    set search_path = public;
alter function public.recalc_order_totals()     set search_path = public;
alter function public.apply_stock_delta(uuid, integer) set search_path = public;
alter function public.adjust_lot_stock()        set search_path = public;
