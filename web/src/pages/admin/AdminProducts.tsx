import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { clp } from '../../lib/format';
import { deleteProduct, fetchAllProducts, saveProduct } from '../../data/admin';
import { errorMessage } from '../../lib/validation';

const STATUSES = ['', 'draft', 'published', 'paused', 'sold_out', 'archived'];

export default function AdminProducts() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <List />
      </AdminLayout>
    </RequireAdmin>
  );
}

function List() {
  const [products, setProducts] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchAllProducts()
      .then(setProducts)
      .catch((err) => setMsg(errorMessage(err)));

  useEffect(() => {
    void load();
  }, []);

  const shown = status ? products.filter((l) => l.status === status) : products;

  async function togglePublish(product: any) {
    setMsg(null);
    try {
      await saveProduct(product.id, { status: product.status === 'published' ? 'paused' : 'published' } as any);
      await load();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  async function onDelete(product: any) {
    if (!window.confirm(`¿Eliminar ${product.sku}? Se bloquea si tiene ventas.`)) return;
    setMsg(null);
    try {
      await deleteProduct(product.id);
      await load();
    } catch (err) {
      setMsg(errorMessage(err));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader title="Productos" subtitle="Publicaciones del catálogo." />
        <Link to="/admin/productos/nuevo" className="rounded-lg bg-accent-500 text-white font-semibold px-4 py-2.5 hover:bg-accent-600">
          + Nuevo producto
        </Link>
      </div>
      <div className="mb-4 flex gap-2 items-center">
        <label className="text-sm text-slate-600" htmlFor="f-status">Estado</label>
        <select id="f-status" className="field-input w-auto!" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      {shown.length === 0 && <EmptyState title="Sin productos" text="Crea el primero con Nuevo producto." />}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="p-3">SKU</th>
              <th className="p-3">Título</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Precio</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-3 font-mono">{l.sku}</td>
                <td className="p-3 font-semibold">{l.title}</td>
                <td className="p-3">{l.status}</td>
                <td className="p-3">{l.stock_quantity}</td>
                <td className="p-3">{clp(Number(l.base_price))}</td>
                <td className="p-3">{l.companies?.name ?? '—'}</td>
                <td className="p-3 flex gap-2">
                  <Link to={`/admin/productos/${l.id}`} className="text-brand-900 underline">Editar</Link>
                  <button onClick={() => void togglePublish(l)} className="text-brand-900 underline">
                    {l.status === 'published' ? 'Pausar' : 'Publicar'}
                  </button>
                  <button onClick={() => void onDelete(l)} className="text-red-700 underline">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
