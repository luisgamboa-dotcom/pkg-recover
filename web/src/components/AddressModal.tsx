import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  errorMessage,
  LIMITS,
  REGIONS,
  checkMax,
  checkPhone,
  checkPostal,
  checkRegion,
  checkRequired,
  checkStreetNumber,
  sanitizeText,
} from '../lib/validation';

export interface AddressFormData {
  label: string;
  recipient: string;
  phone: string;
  streetName: string;
  streetNumber: string;
  apartment: string;
  commune: string;
  city: string;
  region: string;
  postalCode: string;
  notes: string;
  isDefault: boolean;
}

export const emptyAddress: AddressFormData = {
  label: '',
  recipient: '',
  phone: '',
  streetName: '',
  streetNumber: '',
  apartment: '',
  commune: '',
  city: 'Santiago',
  region: '',
  postalCode: '',
  notes: '',
  isDefault: false,
};

const CITIES = ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Otra'];

/**
 * Ventana modal para pedir la dirección. Etiqueta siempre ARRIBA del campo y
 * grilla uniforme: el largo del texto nunca desalinea los recuadros.
 */
export default function AddressModal({
  open,
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: Partial<AddressFormData>;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (data: AddressFormData) => void | Promise<void>;
}) {
  const [f, setF] = useState<AddressFormData>(emptyAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  // initial/onClose son objetos/funciones nuevas en cada render del padre:
  // se guardan en refs para que el formulario NO se reinicie solo.
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      setF({ ...emptyAddress, ...initialRef.current });
      setError(null);
      setBusy(false);
      const t = window.setTimeout(() => firstRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCloseRef.current();
      };
      window.addEventListener('keydown', onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = prev;
      };
    }
    if (!open) {
      wasOpen.current = false;
    }
  }, [open]);

  if (!open) return null;

  const set = (k: keyof AddressFormData, v: string | boolean) =>
    setF((prev) => ({ ...prev, [k]: v }) as AddressFormData);

  async function handleSubmit(e: FormEvent) {
    // El modal vive en un portal fuera de cualquier <form> padre y además se
    // frena la propagación: el envío nunca toca otros formularios.
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    const clean: AddressFormData = {
      label: sanitizeText(f.label, LIMITS.label),
      recipient: sanitizeText(f.recipient, 150),
      phone: sanitizeText(f.phone, LIMITS.phone),
      streetName: sanitizeText(f.streetName, LIMITS.street),
      streetNumber: sanitizeText(f.streetNumber, LIMITS.streetNumber),
      apartment: sanitizeText(f.apartment, LIMITS.apartment),
      commune: sanitizeText(f.commune, LIMITS.commune),
      city: sanitizeText(f.city, LIMITS.city),
      region: sanitizeText(f.region, LIMITS.region),
      postalCode: sanitizeText(f.postalCode, LIMITS.postal).replace(/\D/g, ''),
      notes: sanitizeText(f.notes, LIMITS.notes),
      isDefault: f.isDefault,
    };
    const err =
      checkRequired(clean.recipient, 'Destinatario', 2, 150) ??
      checkPhone(clean.phone) ??
      checkRequired(clean.streetName, 'Calle', 2, LIMITS.street) ??
      checkStreetNumber(clean.streetNumber) ??
      checkMax(clean.apartment, 'Depto', LIMITS.apartment) ??
      checkRequired(clean.commune, 'Comuna', 2, LIMITS.commune) ??
      checkRegion(clean.region) ??
      checkPostal(clean.postalCode) ??
      checkMax(clean.notes, 'Notas', LIMITS.notes) ??
      checkMax(clean.label, 'Etiqueta', LIMITS.label) ??
      checkRequired(clean.city, 'Ciudad', 2, LIMITS.city);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(clean);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // Portal a <body>: el modal nunca queda anidado dentro del <form> del
  // checkout (los formularios anidados rompen el envío y recargan/pierden datos).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-brand-950/60 cursor-default"
      />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-950">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-lg border border-slate-300 w-8 h-8 grid place-items-center font-bold text-slate-500 hover:text-brand-950"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="am-recipient">Nombre / empresa receptora</label>
            <input
              id="am-recipient" ref={firstRef} className="field-input" maxLength={150}
              value={f.recipient} onChange={(e) => set('recipient', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-phone">Teléfono</label>
            <input
              id="am-phone" type="tel" className="field-input" maxLength={LIMITS.phone}
              placeholder="+56 9 1234 5678" value={f.phone} onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-label">Etiqueta (opcional)</label>
            <input
              id="am-label" className="field-input" maxLength={LIMITS.label}
              placeholder="Casa" value={f.label} onChange={(e) => set('label', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="am-street">Calle / avenida</label>
            <input
              id="am-street" className="field-input" maxLength={LIMITS.street}
              placeholder="Av. Providencia" value={f.streetName} onChange={(e) => set('streetName', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-num">Número</label>
            <input
              id="am-num" className="field-input" maxLength={LIMITS.streetNumber}
              placeholder="2500" value={f.streetNumber} onChange={(e) => set('streetNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-apt">Depto / casa (opcional)</label>
            <input
              id="am-apt" className="field-input" maxLength={LIMITS.apartment}
              placeholder="Of. 302" value={f.apartment} onChange={(e) => set('apartment', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-commune">Comuna</label>
            <input
              id="am-commune" className="field-input" maxLength={LIMITS.commune}
              placeholder="Providencia" value={f.commune} onChange={(e) => set('commune', e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="am-city">Ciudad</label>
            <select id="am-city" className="field-input" value={f.city} onChange={(e) => set('city', e.target.value)}>
              {!CITIES.includes(f.city) && f.city && (
                <option value={f.city}>{f.city} (guardada)</option>
              )}
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="am-region">Región</label>
            <select id="am-region" className="field-input" value={f.region} onChange={(e) => set('region', e.target.value)}>
              <option value="">Selecciona…</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="am-postal">Postal (opcional)</label>
            <input
              id="am-postal" className="field-input" inputMode="numeric" maxLength={LIMITS.postal}
              placeholder="7500000" value={f.postalCode} onChange={(e) => set('postalCode', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="am-notes">Notas (opcional)</label>
            <input
              id="am-notes" className="field-input" maxLength={LIMITS.notes}
              value={f.notes} onChange={(e) => set('notes', e.target.value)}
            />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox" className="accent-[#1a365d]"
              checked={f.isDefault} onChange={(e) => set('isDefault', e.target.checked)}
            />
            Usar como dirección principal
          </label>
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={busy}
              className="rounded-lg bg-brand-900 text-white px-5 py-2.5 font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Guardando…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
