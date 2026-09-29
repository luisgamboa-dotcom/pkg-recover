import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { ConfigNotice, EmptyState, ProductImage, PageHeader } from '../components/ui';
import { useCart } from '../lib/cart';
import { isSupabaseConfigured } from '../lib/supabase';
import { useProductsByIds } from '../data/shop';
import { clp, totals } from '../lib/format';
import { parseQty } from '../lib/validation';

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const configured = isSupabaseConfigured;
  const ids = items.map((i) => i.productId);
  const { map, loading } = useProductsByIds(ids);

  const lines = items
    .map((i) => ({ item: i, product: map[i.productId] }))
    .filter((l) => l.product);
  const missing = items.filter((i) => !map[i.productId] && !loading);
  const subtotal = lines.reduce((a, l) => a + l.product!.base_price * l.item.qty, 0);
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
          text="Explora el catálogo y agrega productos verificados."
        />
      )}
      {items.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {loading && <p className="text-sm text-slate-500">Cargando…</p>}
            {lines.map(({ item, product }) => (
              <article
                key={item.productId}
                className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4"
              >
                <ProductImage product={product!} className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1">
                  <Link
                    to={`/productos/${product!.id}`}
                    className="font-bold text-brand-950 hover:underline"
                  >
                    {product!.title}
                  </Link>
                  <p className="text-xs text-slate-500 font-mono">{product!.sku}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-sm text-slate-600">
                      Cant.{' '}
                      <input
                        type="number"
                        min={0}
                        max={Math.max(product!.stock_quantity, 1)}
                        value={item.qty}
                        onChange={(e) =>
                          setQty(
                            item.productId,
                            parseQty(e.target.value, Math.max(product!.stock_quantity, 1)),
                          )
                        }
                        className="field-input w-20! inline-block"
                      />
                    </label>
                    <button
                      onClick={() => remove(item.productId)}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <p className="font-extrabold text-brand-950">
                  {clp(product!.base_price * item.qty)}
                </p>
              </article>
            ))}
            {missing.length > 0 && (
              <p className="text-sm text-amber-700">
                {missing.length} producto(s) ya no están disponibles y se excluirán
                de la compra.
              </p>
            )}
          </div>
          <aside className="bg-white rounded-2xl border border-slate-200 p-5 h-fit">
            <h2 className="font-bold text-brand-950">Resumen</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-semibold">{clp(t.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Envío estimado</dt>
                <dd className="font-semibold">{clp(t.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA 19%</dt>
                <dd className="font-semibold">{clp(t.tax)}</dd>
              </div>
              <div className="flex justify-between text-base font-extrabold text-brand-950 border-t border-slate-200 pt-2">
                <dt>Total</dt>
                <dd>{clp(t.total)}</dd>
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
