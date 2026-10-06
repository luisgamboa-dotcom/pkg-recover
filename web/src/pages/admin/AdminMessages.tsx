import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { fetchOrphanMessages } from '../../data/account';
import { formatDate } from '../../lib/format';
import { errorMessage } from '../../lib/validation';

export default function AdminMessages() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <View />
      </AdminLayout>
    </RequireAdmin>
  );
}

function View() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrphanMessages()
      .then(setItems)
      .catch((err) => setMsg(errorMessage(err)));
  }, []);

  return (
    <>
      <PageHeader
        title="Mensajes sin destinatario"
        subtitle="Consultas a productos cuyo proveedor fue eliminado."
      />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      {items.length === 0 && (
        <EmptyState
          title="Sin mensajes huérfanos"
          text="Cuando se elimine un proveedor, las consultas a sus productos aparecerán aquí."
        />
      )}
      <div className="space-y-3">
        {items.map((m) => (
          <article key={m.id} className="bg-white rounded-2xl border border-amber-300 p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 rounded-full px-2.5 py-0.5">
                Sin destinatario · proveedor eliminado
              </span>
              <span className="ml-auto text-xs text-slate-400">{formatDate(m.created_at)}</span>
            </div>
            <p className="mt-2 font-bold text-brand-950">
              <Link to={`/productos/${m.product_id}`} className="hover:underline">
                {m.products?.title ?? 'Producto'} {m.products?.sku ? `· ${m.products.sku}` : ''}
              </Link>
            </p>
            <p className="mt-1 text-sm text-slate-600">{m.body}</p>
            <p className="mt-1 text-xs text-slate-400">
              De: {m.sender?.first_name ?? 'Usuario'}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
