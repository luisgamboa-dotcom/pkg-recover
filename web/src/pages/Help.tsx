import { useState, type FormEvent } from 'react';
import Layout from '../components/Layout';
import { ConfigNotice, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { createTicket, useFaqs, useMyOrders } from '../data/account';
import {
  LIMITS,
  checkRequired,
  isUuid,
  sanitizeMultiline,
  sanitizeText,
} from '../lib/validation';

const TICKET_CATEGORIES = [
  ['order', 'Pedido'],
  ['payment', 'Pago'],
  ['shipping', 'Despacho'],
  ['product', 'Lote / producto'],
  ['account', 'Mi cuenta'],
  ['other', 'Otro'],
];

export default function Help() {
  const { user } = useAuth();
  const faqs = useFaqs();
  const { orders } = useMyOrders(user?.id);
  const [open, setOpen] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('order');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onTicket(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setResult(null);
    // Sanitiza antes de validar y guardar (el mensaje lo lee el admin).
    const cleanSubject = sanitizeText(subject, LIMITS.subject);
    const cleanMessage = sanitizeMultiline(message, LIMITS.message);
    const validCategories = TICKET_CATEGORIES.map(([v]) => v);
    const safeCategory = validCategories.includes(category) ? category : 'other';
    const safeOrderId = orderId && isUuid(orderId) ? orderId : null;
    const fieldErr =
      checkRequired(cleanSubject, 'Asunto', 5, LIMITS.subject) ??
      checkRequired(cleanMessage, 'Mensaje', 10, LIMITS.message);
    if (fieldErr) {
      setResult(fieldErr);
      return;
    }
    setBusy(true);
    try {
      await createTicket({
        profileId: user.id,
        orderId: safeOrderId,
        subject: cleanSubject,
        category: safeCategory,
        message: cleanMessage,
      });
      setSubject('');
      setMessage('');
      setOrderId('');
      setResult('Ticket creado. Te contactaremos por correo.');
    } catch (err) {
      setResult(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <PageHeader title="Centro de ayuda" subtitle="Preguntas frecuentes y soporte." />
      {!isSupabaseConfigured && (
        <div className="mb-4">
          <ConfigNotice />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-bold text-brand-950">Preguntas frecuentes</h2>
          <div className="mt-3 space-y-2">
            {faqs.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-slate-200">
                <button
                  onClick={() => setOpen(open === f.id ? null : f.id)}
                  className="w-full text-left px-4 py-3 font-semibold text-sm text-brand-950"
                  aria-expanded={open === f.id}
                >
                  {f.question}
                </button>
                {open === f.id && (
                  <p className="px-4 pb-4 text-sm text-slate-600">{f.answer}</p>
                )}
              </div>
            ))}
            {faqs.length === 0 && (
              <p className="text-sm text-slate-500">
                Las respuestas se cargan desde la base de datos (tabla faqs).
              </p>
            )}
          </div>
          <div className="mt-4 text-sm text-slate-600 bg-white rounded-xl border border-slate-200 p-4">
            <p className="font-bold text-brand-950">Contacto</p>
            <p>soporte@recuperapack.com · Lun–Vie 8:00–18:00 (Bogotá)</p>
          </div>
        </section>

        <section>
          <h2 className="font-bold text-brand-950">Abrir ticket de soporte</h2>
          {!user ? (
            <p className="mt-3 text-sm text-slate-500">
              Debes iniciar sesión para abrir un ticket.
            </p>
          ) : (
            <form onSubmit={onTicket} className="mt-3 bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div>
                <label className="field-label" htmlFor="tk-subject">Asunto</label>
                <input id="tk-subject" className="field-input" maxLength={LIMITS.subject} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="tk-cat">Categoría</label>
                  <select id="tk-cat" className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {TICKET_CATEGORIES.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="tk-order">Pedido (opcional)</label>
                  <select id="tk-order" className="field-input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                    <option value="">—</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>{o.order_number}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="tk-msg">Mensaje</label>
                <textarea id="tk-msg" className="field-input" rows={4} maxLength={LIMITS.message} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              {result && <p className="text-sm text-slate-600">{result}</p>}
              <button disabled={busy} className="rounded-lg bg-brand-900 text-white font-semibold px-5 py-2.5 hover:bg-brand-700 disabled:opacity-50">
                {busy ? 'Enviando…' : 'Enviar ticket'}
              </button>
            </form>
          )}
        </section>
      </div>
    </Layout>
  );
}
