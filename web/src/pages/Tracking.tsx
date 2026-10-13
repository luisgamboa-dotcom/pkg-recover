import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { PageHeader } from '../components/ui';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import { formatDate } from '../lib/format';
import { sanitizeText } from '../lib/validation';

interface TrackingEvent {
  status: string;
  location: string | null;
  at: string;
}

interface Tracking {
  tracking_number: string;
  status: string;
  carrier: string;
  estimated_at: string | null;
  delivered_at: string | null;
  order_number: string;
  ordered_at: string;
  events: TrackingEvent[] | null;
}

const STEP_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  picked_up: 'Retirado',
  in_transit: 'En tránsito',
  out_for_delivery: 'En reparto',
  delivered: 'Entregado',
  failed: 'Fallido',
  returned: 'Devuelto',
};

async function lookup(code: string): Promise<Tracking | null> {
  const { data, error } = await requireSupabase()
    .from('v_tracking_public')
    .select('*')
    .eq('tracking_number', code)
    .maybeSingle();
  if (error) throw error;
  return (data as Tracking | null) ?? null;
}

export default function TrackingPage() {
  const { codigo } = useParams();
  const [input, setInput] = useState(codigo ?? '');
  const [result, setResult] = useState<Tracking | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(code: string) {
    const clean = sanitizeText(code, 100).trim().toUpperCase();
    if (clean.length < 3) {
      setError('Ingresa un código de seguimiento válido.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Seguimiento no disponible en este momento.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await lookup(clean));
    } catch {
      setError('No pudimos consultar el seguimiento. Inténtalo más tarde.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void search(input);
  }

  useEffect(() => {
    if (codigo && codigo.trim().length >= 3) void search(codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  return (
    <Layout>
      <PageHeader title="Rastrear pedido" subtitle="Consulta pública con tu código de seguimiento." />
      <form onSubmit={onSubmit} className="flex gap-2 max-w-lg">
        <input
          className="field-input min-w-0 flex-1 font-mono uppercase"
          maxLength={100}
          placeholder="Ej. RP-88341209"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Código de seguimiento"
        />
        <button disabled={busy} className="rounded-lg bg-brand-900 text-white px-5 font-semibold shrink-0 hover:bg-brand-700 disabled:opacity-50">
          {busy ? '…' : 'Rastrear'}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 max-w-lg">{error}</p>}
      {result === null && (
        <p className="mt-4 text-sm text-slate-500">Sin resultados para ese código. Revisa que esté bien escrito.</p>
      )}
      {result != null && (
        <section className="mt-6 max-w-2xl bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-mono font-extrabold text-xl text-brand-950">{result.tracking_number}</h2>
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-brand-900 rounded-full px-3 py-1">
              {STEP_LABEL[result.status] ?? result.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pedido {result.order_number} · {result.carrier}
            {result.estimated_at && ` · estimado: ${formatDate(result.estimated_at)}`}
          </p>
          <ol className="mt-4 relative space-y-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {(result.events ?? []).map((ev, i) => (
              <li key={i} className="relative flex gap-3">
                <span className="relative z-10 grid place-items-center w-7 h-7 rounded-full bg-brand-900 text-white text-sm shrink-0" aria-hidden>
                  {ev.status === 'delivered' ? '✓' : '•'}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-brand-950 text-sm">{STEP_LABEL[ev.status] ?? ev.status}</p>
                  <p className="text-xs text-slate-500">{ev.location ?? ''} · {formatDate(ev.at)}</p>
                </div>
              </li>
            ))}
            {(result.events ?? []).length === 0 && (
              <li className="text-sm text-slate-500">Aún sin eventos registrados.</li>
            )}
          </ol>
          <p className="mt-4 text-xs text-slate-400">
            ¿Necesitas ayuda? <Link to="/ayuda" className="underline font-semibold">Centro de ayuda</Link>
          </p>
        </section>
      )}
    </Layout>
  );
}
