import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { clp, formatDate } from '../lib/format';
import { isUuid } from '../lib/validation';

interface CertItem {
  title: string;
  sku: string;
  quantity: number;
  wasteKg: number;
}

export default function Certificate() {
  return (
    <ProtectedRoute>
      <View />
    </ProtectedRoute>
  );
}

function View() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<CertItem[]>([]);
  const [co2, setCo2] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !isUuid(id) || !user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    (async () => {
      const sb = requireSupabase();
      const { data: o } = await sb
        .from('orders')
        .select('id, order_number, status, total, created_at, buyer_id')
        .eq('id', id)
        .eq('buyer_id', user.id)
        .maybeSingle();
      if (!o || !['delivered', 'paid', 'shipped'].includes(o.status)) {
        setLoading(false);
        return;
      }
      const [{ data: lines }, { data: factor }] = await Promise.all([
        sb
          .from('order_items')
          .select('quantity, products (title, sku, waste_avoided_kg)')
          .eq('order_id', id),
        sb.from('impact_factors').select('value').eq('key', 'co2_kg_per_waste_kg').maybeSingle(),
      ]);
      const mapped: CertItem[] = ((lines ?? []) as any[]).map((l) => ({
        title: l.products?.title ?? 'Producto',
        sku: l.products?.sku ?? '',
        quantity: Number(l.quantity ?? 0),
        wasteKg: Number(l.products?.waste_avoided_kg ?? 0) * Number(l.quantity ?? 0),
      }));
      const waste = mapped.reduce((a, i) => a + i.wasteKg, 0);
      setOrder(o);
      setItems(mapped);
      setCo2(Math.round(waste * Number((factor as any)?.value ?? 2) * 10) / 10);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [id, user]);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Generando certificado…</p>
      </Layout>
    );
  }
  if (!order) {
    return (
      <Layout>
        <EmptyState
          title="Certificado no disponible"
          text="Solo los pedidos pagados, despachados o entregados tienen certificado circular."
        />
      </Layout>
    );
  }
  const waste = items.reduce((a, i) => a + i.wasteKg, 0);

  return (
    <Layout>
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <p className="text-sm text-slate-500">
          <Link to={`/pedidos/${order.id}`} className="hover:underline">Volver al pedido</Link>
        </p>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-900 text-white font-semibold px-5 py-2.5 hover:bg-brand-700"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="mt-4 bg-white rounded-3xl border-2 border-brand-900 p-8 lg:p-12 text-center shadow-xl">
        <span className="grid place-items-center w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 font-extrabold text-2xl text-white">
          R
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-accent-600">
          Certificado de compra circular
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-950">RecuperaPack</h1>
        <p className="mt-3 text-slate-600">
          Pedido <span className="font-mono font-bold text-brand-950">{order.order_number}</span> ·{' '}
          {formatDate(order.created_at)} · Total {clp(Number(order.total))}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3 max-w-xl mx-auto">
          <div className="rounded-2xl bg-brand-50 border border-slate-200 p-4">
            <p className="text-2xl font-extrabold text-brand-950">{items.reduce((a, i) => a + i.quantity, 0)}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">productos recirculados</p>
          </div>
          <div className="rounded-2xl bg-brand-50 border border-slate-200 p-4">
            <p className="text-2xl font-extrabold text-brand-950">{Math.round(waste)} kg</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">desecho evitado</p>
          </div>
          <div className="rounded-2xl bg-brand-50 border border-slate-200 p-4">
            <p className="text-2xl font-extrabold text-brand-950">{co2} kg</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">CO₂e estimado evitado</p>
          </div>
        </div>
        <ul className="mt-6 text-left text-sm text-slate-600 max-w-xl mx-auto space-y-1.5">
          {items.map((i, n) => (
            <li key={n} className="flex justify-between gap-2 border-b border-slate-100 pb-1.5 last:border-0">
              <span>{i.title} <span className="font-mono text-slate-400">{i.sku}</span> × {i.quantity}</span>
              <span className="whitespace-nowrap">{Math.round(i.wasteKg)} kg ♻️</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-slate-400">
          Folio {order.order_number} · Verificable en recuperapack · Factores estimativos ajustables por administración.
        </p>
      </div>
    </Layout>
  );
}
