import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { ConfigNotice, EmptyState, LotImage, PageHeader } from '../components/ui';
import { useCart } from '../lib/cart';
import { isSupabaseConfigured } from '../lib/supabase';
import { useLotsByIds } from '../data/shop';
import { cop, totals } from '../lib/format';
import { parseQty } from '../lib/validation';

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const configured = isSupabaseConfigured;
  const ids = items.map((i) => i.lotId);
  const { map, loading } = useLotsByIds(ids);

  const lines = items
    .map((i) => ({ item: i, lot: map[i.lotId] }))
    .filter((l) => l.lot);
  const missing = items.filter((i) => !map[i.lotId] && !loading);
  const subtotal = lines.reduce((a, l) => a + l.lot!.base_price * l.item.qty, 0);
  const t = totals(subtotal);

  return (
    <Layout>
      <PageHeader title="Carrito" subtitle="Revisa cantidades antes de pagar." />
      {!configured && (
        <div className="mb-4">
          <ConfigNotice />
        </div>
      )}
      {items.length === 0 && (
        <EmptyState
          title="Carrito vacío"
          text="Explora el catálogo y agrega lotes verificados."
        />
      )}
      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {loading && <p className="text-sm text-slate-500">Cargando…</p>}
            {lines.map(({ item, lot }) => (
              <article
                key={item.lotId}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4"
              >
                <LotImage lot={lot!} className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1">
                  <Link
                    to={`/lotes/${lot!.id}`}
                    className="font-bold text-brand-950 hover:underline"
                  >
                    {lot!.title}
                  </Link>
                  <p className="text-xs text-slate-500 font-mono">{lot!.sku}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-sm text-slate-600">
                      Cant.{' '}
                      <input
                        type="number"
                        min={0}
                        max={Math.max(lot!.stock_quantity, 1)}
                        value={item.qty}
                        onChange={(e) =>
                          setQty(
                            item.lotId,
                            parseQty(e.target.value, Math.max(lot!.stock_quantity, 1)),
                          )
                        }
                        className="field-input !w-20 inline-block"
                      />
                    </label>
                    <button
                      onClick={() => remove(item.lotId)}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <p className="font-extrabold text-brand-950">
                  {cop(lot!.base_price * item.qty)}
                </p>
              </article>
            ))}
            {missing.length > 0 && (
              <p className="text-sm text-amber-700">
                {missing.length} lote(s) ya no están disponibles y se excluirán
                de la compra.
              </p>
            )}
          </div>
          <aside className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
            <h2 className="font-bold text-brand-950">Resumen</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-semibold">{cop(t.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Envío (RecuperaLogistics)</dt>
                <dd className="font-semibold">{cop(t.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA 19%</dt>
                <dd className="font-semibold">{cop(t.tax)}</dd>
              </div>
              <div className="flex justify-between text-base font-extrabold text-brand-950 border-t border-slate-200 pt-2">
                <dt>Total</dt>
                <dd>{cop(t.total)}</dd>
              </div>
            </dl>
            <Link
              to="/checkout"
              className="mt-4 block text-center rounded-lg bg-accent-500 text-white font-semibold py-3 hover:bg-accent-600"
            >
              Continuar al pago
            </Link>
          </aside>
        </div>
      )}
    </Layout>
  );
}
