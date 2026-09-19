-- ============================================================================
-- pkg-recover / RecuperaPack — Migración 7: blindar apply_stock_delta
-- La función es SECURITY DEFINER (lo exige el checkout) y acepta argumentos,
-- por lo que un cliente podría invocarla directo por RPC. El guard
-- pg_trigger_depth() = 0 garantiza que SOLO corre dentro de su trigger
-- (adjust_lot_stock), que a su vez solo toca el lote del ítem insertado.
-- ============================================================================

create or replace function public.apply_stock_delta(p_lot_id uuid, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
begin
  if pg_trigger_depth() = 0 then
    raise exception 'Uso interno: solo vía trigger de order_items';
  end if;

  update public.lots
     set stock_quantity = stock_quantity + p_delta
   where id = p_lot_id
  returning stock_quantity into v_stock;

  if v_stock is null then
    raise exception 'Lote % no existe', p_lot_id;
  end if;
  if v_stock < 0 then
    raise exception 'Stock insuficiente para el lote %', p_lot_id;
  end if;

  update public.lots
     set status = case when stock_quantity = 0 then 'sold_out'
                       when status = 'sold_out' then 'published'
                       else status end
   where id = p_lot_id;
end $$;