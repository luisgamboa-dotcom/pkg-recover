import { useEffect, useState, type FormEvent } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { requireSupabase } from '../lib/supabase';
import {
  deleteAddress,
  saveAddress,
  updateProfile,
  useAddresses,
  usePrefs,
  type Address,
} from '../data/account';
import {
  LIMITS,
  checkMax,
  checkName,
  checkPassword,
  checkPhone,
  checkRequired,
  sanitizeText,
} from '../lib/validation';

const PREF_LABELS: [keyof import('../data/account').Prefs, string][] = [
  ['offers', 'Nuevas ofertas'],
  ['new_lots', 'Lotes publicados'],
  ['order_updates', 'Cambios en mis pedidos'],
  ['shipping_updates', 'Cambios en despachos'],
  ['availability', 'Disponibilidad de favoritos'],
];

export default function Profile() {
  return (
    <ProtectedRoute>
      <Editor />
    </ProtectedRoute>
  );
}

function Editor() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { items: addresses, refresh: refreshAddresses } = useAddresses(user?.id);
  const { prefs, save: savePrefs } = usePrefs(user?.id);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const [editing, setEditing] = useState<Address | null>(null);
  const [label, setLabel] = useState('');
  const [recipient, setRecipient] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [city, setCity] = useState('Bogotá D.C.');
  const [addressLine, setAddressLine] = useState('');
  const [notes, setNotes] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);

  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile?.firstName ?? '');
    setLastName(profile?.lastName ?? '');
  }, [profile]);

  async function onProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMsg(null);
    const clean = {
      firstName: sanitizeText(firstName, LIMITS.name),
      lastName: sanitizeText(lastName, LIMITS.name),
      phone: sanitizeText(phone, LIMITS.phone),
    };
    const errMsg =
      checkName(clean.firstName, 'Nombre') ??
      checkName(clean.lastName, 'Apellido') ??
      (clean.phone ? checkPhone(clean.phone) : null);
    if (errMsg) {
      setMsg(errMsg);
      return;
    }
    try {
      await updateProfile(user.id, clean);
      await refreshProfile();
      setMsg('Datos actualizados.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(a: Address | null) {
    setEditing(a);
    setLabel(a?.label ?? '');
    setRecipient(a?.recipient_name ?? '');
    setAPhone(a?.phone ?? '');
    setCity(a?.city ?? 'Bogotá D.C.');
    setAddressLine(a?.address_line ?? '');
    setNotes(a?.delivery_notes ?? '');
    setIsDefault(a?.is_default ?? addresses.length === 0);
    setAddrMsg(null);
  }

  async function onAddress(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAddrMsg(null);
    const clean = {
      label: sanitizeText(label, LIMITS.label),
      recipient: sanitizeText(recipient, 150),
      phone: sanitizeText(aPhone, LIMITS.phone),
      city: sanitizeText(city, LIMITS.city),
      addressLine: sanitizeText(addressLine, LIMITS.address),
      notes: sanitizeText(notes, LIMITS.notes),
    };
    const errMsg =
      checkRequired(clean.recipient, 'Destinatario', 2, 150) ??
      checkPhone(clean.phone) ??
      checkRequired(clean.addressLine, 'Dirección', 5, LIMITS.address) ??
      checkMax(clean.notes, 'Notas', LIMITS.notes) ??
      checkMax(clean.label, 'Etiqueta', LIMITS.label);
    if (errMsg) {
      setAddrMsg(errMsg);
      return;
    }
    try {
      await saveAddress(user.id, {
        id: editing?.id,
        label: clean.label || null,
        recipient_name: clean.recipient,
        phone: clean.phone,
        city: clean.city,
        address_line: clean.addressLine,
        delivery_notes: clean.notes || null,
        is_default: isDefault,
      });
      startEdit(null);
      await refreshAddresses();
    } catch (err) {
      setAddrMsg(err instanceof Error ? err.message : String(err));
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    const cleanPass = newPass.slice(0, LIMITS.password);
    const passErr = checkPassword(cleanPass);
    if (passErr) {
      setPassMsg(passErr);
      return;
    }
    try {
      const { error } = await requireSupabase().auth.updateUser({ password: cleanPass });
      if (error) throw error;
      setNewPass('');
      setPassMsg('Contraseña actualizada.');
    } catch (err) {
      setPassMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Layout>
      <PageHeader
        title="Mi cuenta"
        subtitle={`${user?.email ?? ''} · ${profile?.roleName ?? ''}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-brand-950">Datos personales</h2>
          <form onSubmit={onProfile} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="pf-fn">Nombre</label>
                <input id="pf-fn" className="field-input" maxLength={LIMITS.name} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="pf-ln">Apellido</label>
                <input id="pf-ln" className="field-input" maxLength={LIMITS.name} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="pf-ph">Teléfono</label>
              <input id="pf-ph" className="field-input" maxLength={LIMITS.phone} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 123 4567" />
            </div>
            {msg && <p className="text-sm text-slate-600">{msg}</p>}
            <button className="rounded-lg bg-brand-900 text-white font-semibold px-5 py-2.5 hover:bg-brand-700">
              Guardar
            </button>
          </form>

          <h2 className="mt-6 font-bold text-brand-950">Cambiar contraseña</h2>
          <form onSubmit={onPassword} className="mt-3 flex gap-2">
            <input
              type="password"
              className="field-input"
              maxLength={LIMITS.password}
              placeholder="Nueva contraseña"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              aria-label="Nueva contraseña"
            />
            <button className="rounded-lg border border-slate-300 px-4 font-semibold shrink-0">
              Cambiar
            </button>
          </form>
          {passMsg && <p className="mt-1 text-sm text-slate-600">{passMsg}</p>}

          <h2 className="mt-6 font-bold text-brand-950">Notificaciones</h2>
          <div className="mt-2 space-y-1.5 text-sm">
            {PREF_LABELS.map(([key, labelText]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[#1a365d]"
                  checked={prefs?.[key] ?? true}
                  onChange={(e) => {
                    if (prefs) void savePrefs({ ...prefs, [key]: e.target.checked });
                  }}
                />
                {labelText}
              </label>
            ))}
          </div>

          <button
            onClick={() => void signOut()}
            className="mt-6 rounded-lg border border-red-300 text-red-700 px-4 py-2 font-semibold text-sm"
          >
            Cerrar sesión
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-brand-950">Direcciones de despacho</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 p-3 flex justify-between gap-2">
                <span>
                  <span className="font-semibold">
                    {a.label ?? 'Dirección'}{' '}
                    {a.is_default && (
                      <span className="text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                        Principal
                      </span>
                    )}
                  </span>
                  <span className="block text-slate-600">
                    {a.recipient_name} · {a.address_line} · {a.city}
                  </span>
                </span>
                <span className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(a)} className="text-brand-900 underline">
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      void deleteAddress(a.id).then(() => refreshAddresses());
                    }}
                    className="text-red-700 underline"
                  >
                    Borrar
                  </button>
                </span>
              </li>
            ))}
            {addresses.length === 0 && (
              <p className="text-sm text-slate-500">Sin direcciones guardadas.</p>
            )}
          </ul>

          <h3 className="mt-4 font-bold text-brand-950 text-sm">
            {editing ? 'Editar dirección' : 'Nueva dirección'}
          </h3>
          <form onSubmit={onAddress} className="mt-2 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <input className="field-input" maxLength={LIMITS.label} placeholder="Etiqueta (Casa)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Etiqueta" />
              <input className="field-input" maxLength={150} placeholder="Destinatario" value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Destinatario" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input className="field-input" maxLength={LIMITS.phone} placeholder="Teléfono" value={aPhone} onChange={(e) => setAPhone(e.target.value)} aria-label="Teléfono" />
              <input className="field-input" maxLength={LIMITS.city} placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ciudad" />
            </div>
            <input className="field-input" maxLength={LIMITS.address} placeholder="Dirección exacta" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} aria-label="Dirección" />
            <input className="field-input" maxLength={LIMITS.notes} placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notas" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#1a365d]" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Usar como principal
            </label>
            {addrMsg && <p className="text-sm text-slate-600">{addrMsg}</p>}
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand-900 text-white font-semibold px-4 py-2 hover:bg-brand-700">
                {editing ? 'Guardar' : 'Agregar'}
              </button>
              {editing && (
                <button type="button" onClick={() => startEdit(null)} className="rounded-lg border border-slate-300 px-4 py-2">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
