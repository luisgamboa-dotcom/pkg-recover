import { useEffect, useState, type FormEvent } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { fetchCompanies, saveCompany } from '../../data/admin';
import { checkMax, checkRequired, sanitizeText } from '../../lib/validation';

export default function AdminCompanies() {
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
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bogotá D.C.');
  const [agreement, setAgreement] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchCompanies()
      .then(setItems)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));

  useEffect(() => { void load(); }, []);

  function startEdit(c: any | null) {
    setEditing(c);
    setName(c?.name ?? ''); setTaxId(c?.tax_id ?? ''); setCode(c?.verification_code ?? '');
    setVerified(c?.is_verified ?? false); setEmail(c?.contact_email ?? '');
    setPhone(c?.contact_phone ?? ''); setCity(c?.city ?? 'Bogotá D.C.');
    setAgreement((c as any)?.agreement_details ?? '');
    setMsg(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const clean = {
      name: sanitizeText(name, 200),
      tax_id: sanitizeText(taxId, 50),
      verification_code: sanitizeText(code, 50).toUpperCase(),
      contact_email: sanitizeText(email, 254).toLowerCase(),
      contact_phone: sanitizeText(phone, 30),
      city: sanitizeText(city, 100),
      agreement_details: sanitizeText(agreement, 2000),
    };
    const errLen =
      checkRequired(clean.name, 'Nombre', 2, 200) ??
      checkMax(clean.tax_id, 'NIT', 50) ??
      checkMax(clean.verification_code, 'Código', 50);
    if (errLen) { setMsg(errLen); return; }
    if (clean.verification_code && !/^[A-Z0-9-]{4,50}$/.test(clean.verification_code)) {
      setMsg('Código de verificación inválido (ej. LOG-9982-RP).');
      return;
    }
    try {
      await saveCompany(editing?.id ?? null, {
        name: clean.name,
        tax_id: clean.tax_id || null,
        verification_code: clean.verification_code || null,
        is_verified: verified,
        contact_email: clean.contact_email || null,
        contact_phone: clean.contact_phone || null,
        city: clean.city || 'Bogotá D.C.',
        agreement_details: clean.agreement_details || null,
      });
      startEdit(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Empresas" subtitle="Registro, verificación y convenios." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="bg-white rounded-2xl border overflow-x-auto h-fit">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th className="p-3">Empresa</th><th className="p-3">NIT</th><th className="p-3">Código</th><th className="p-3">Estado</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-semibold">{c.name}</td>
                  <td className="p-3">{c.tax_id ?? '—'}</td>
                  <td className="p-3 font-mono">{c.verification_code ?? '—'}</td>
                  <td className="p-3">{c.is_verified ? '✅ Verificada' : '⏳ Pendiente'}</td>
                  <td className="p-3"><button onClick={() => startEdit(c)} className="text-brand-900 underline">Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <EmptyState title="Sin empresas" text="Registra la primera empresa proveedora." />}
        </div>
        <form onSubmit={onSubmit} className="bg-white rounded-2xl border p-4 space-y-2.5 h-fit">
          <h2 className="font-bold text-brand-950">{editing ? 'Editar empresa' : 'Nueva empresa'}</h2>
          <input className="field-input" maxLength={200} placeholder="Nombre *" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
          <div className="grid grid-cols-2 gap-2.5">
            <input className="field-input" maxLength={50} placeholder="NIT" value={taxId} onChange={(e) => setTaxId(e.target.value)} aria-label="NIT" />
            <input className="field-input" maxLength={50} placeholder="Código (LOG-####-RP)" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input className="field-input" maxLength={254} placeholder="Email contacto" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <input className="field-input" maxLength={30} placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Teléfono" />
          </div>
          <input className="field-input" maxLength={100} placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad" />
          <textarea className="field-input" rows={3} maxLength={2000} placeholder="Convenio / notas" value={agreement} onChange={(e) => setAgreement(e.target.value)} aria-label="Convenio" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[#1a365d]" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Empresa verificada
          </label>
          <div className="flex gap-2">
            <button className="rounded-lg bg-brand-900 text-white px-4 py-2 font-semibold">{editing ? 'Guardar' : 'Crear'}</button>
            {editing && <button type="button" onClick={() => startEdit(null)} className="rounded-lg border px-4 py-2">Cancelar</button>}
          </div>
        </form>
      </div>
    </>
  );
}
