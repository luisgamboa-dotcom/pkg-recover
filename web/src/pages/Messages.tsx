import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { fetchThreadMessages, fetchThreads, sendMessage, type Thread } from '../data/account';
import { formatDate } from '../lib/format';
import { LIMITS, checkRequired, sanitizeMultiline } from '../lib/validation';

export default function Messages() {
  return (
    <ProtectedRoute>
      <Inbox />
    </ProtectedRoute>
  );
}

function Inbox() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeLot, setActiveLot] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const loadThreads = () => {
    if (!user) return;
    fetchThreads(user.id)
      .then(setThreads)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));
  };

  useEffect(loadThreads, [user]);

  async function openThread(t: Thread) {
    if (!user) return;
    setActiveLot(t.lotId);
    const msgs = await fetchThreadMessages(user.id, t.lotId).catch(() => []);
    setMessages(msgs);
    loadThreads();
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeLot) return;
    const clean = sanitizeMultiline(draft, LIMITS.message);
    const errLen = checkRequired(clean, 'Mensaje', 1, LIMITS.message);
    if (errLen) { setMsg(errLen); return; }
    // Responde al otro participante del hilo.
    const other =
      messages.filter((m) => m.sender_id !== user.id).slice(-1)[0]?.sender_id ??
      messages.filter((m) => m.receiver_id !== user.id).slice(-1)[0]?.receiver_id;
    const receiver = typeof other === 'string' ? other : undefined;
    if (!receiver) { setMsg('No se pudo determinar el destinatario.'); return; }
    try {
      await sendMessage(activeLot, user.id, receiver, clean);
      setDraft('');
      const msgs = await fetchThreadMessages(user.id, activeLot);
      setMessages(msgs);
      loadThreads();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Layout>
      <PageHeader title="Mensajes" subtitle="Consultas directas por lote con vendedores." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      {threads.length === 0 && (
        <EmptyState title="Sin conversaciones" text="Desde un lote usa «Consultar al vendedor»." />
      )}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.lotId}>
              <button
                onClick={() => void openThread(t)}
                className={`w-full text-left bg-white rounded-2xl border p-3 hover:shadow ${activeLot === t.lotId ? 'border-brand-900' : ''}`}
              >
                <p className="text-sm font-bold text-brand-950 truncate">
                  {t.lotTitle} {t.unread > 0 && <span className="ml-1 text-xs text-white bg-accent-500 rounded-full px-2 py-0.5">{t.unread}</span>}
                </p>
                <p className="text-xs text-slate-500">{t.otherName} · {formatDate(t.lastAt)}</p>
                <p className="text-sm text-slate-600 truncate">{t.lastBody}</p>
              </button>
            </li>
          ))}
        </ul>
        <section className="bg-white rounded-2xl border p-4 min-h-[320px] flex flex-col">
          {!activeLot && <p className="text-sm text-slate-500 m-auto">Elige una conversación.</p>}
          {activeLot && (
            <>
              <div className="flex-1 space-y-2 overflow-auto max-h-[420px]">
                {messages.map((m) => (
                  <p
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender_id === user?.id
                        ? 'ml-auto bg-brand-900 text-white'
                        : 'bg-slate-100 text-brand-950'
                    }`}
                  >
                    {m.body}
                  </p>
                ))}
              </div>
              <form onSubmit={onSend} className="mt-3 flex gap-2">
                <input
                  className="field-input"
                  maxLength={LIMITS.message}
                  placeholder="Escribe tu mensaje…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Mensaje"
                />
                <button className="rounded-lg bg-brand-900 text-white px-4 font-semibold shrink-0">Enviar</button>
              </form>
            </>
          )}
        </section>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        <Link to="/catalogo" className="underline">Volver al catálogo</Link>
      </p>
    </Layout>
  );
}
