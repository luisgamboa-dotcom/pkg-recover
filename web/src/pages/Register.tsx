import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type AccountType } from '../auth/AuthContext';
import AuthLayout from '../components/AuthLayout';
import {
  LIMITS,
  checkEmail,
  checkName,
  checkPassword,
  checkPhone,
  normalizeEmail,
  sanitizeText,
} from '../lib/validation';

const accountOptions: { value: AccountType; title: string; text: string }[] = [
  {
    value: 'customer',
    title: 'Cliente particular',
    text: 'Compra lotes, sigue pedidos y guarda favoritos.',
  },
  {
    value: 'reseller',
    title: 'Revendedor',
    text: 'Compra por volumen con precios especiales.',
  },
  {
    value: 'company',
    title: 'Empresa proveedora',
    text: 'Entrega paquetes y consulta valor recuperado.',
  },
];

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

function friendlyError(message: string): string {
  if (/already registered|already exists|user already/i.test(message))
    return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (/password/i.test(message))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (/email/i.test(message)) return 'Revisa el formato del correo electrónico.';
  return message;
}

export default function Register() {
  const { configured, signUp, user } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  /** Limpia todo antes de validar: lo sanitizado es lo que se envía. */
  function cleaned() {
    return {
      firstName: sanitizeText(firstName, LIMITS.name),
      lastName: sanitizeText(lastName, LIMITS.name),
      email: normalizeEmail(email),
      phone: sanitizeText(phone, LIMITS.phone),
      password: password.slice(0, LIMITS.password),
    };
  }

  function validate(c: ReturnType<typeof cleaned>): FieldErrors {
    const e: FieldErrors = {};
    const fn = checkName(c.firstName, 'Nombre');
    if (fn) e.firstName = fn;
    const ln = checkName(c.lastName, 'Apellido');
    if (ln) e.lastName = ln;
    const em = checkEmail(c.email);
    if (em) e.email = em;
    const ph = checkPhone(c.phone);
    if (ph) e.phone = ph;
    const pw = checkPassword(c.password);
    if (pw) e.password = pw;
    if (confirm !== c.password) e.confirm = 'No coincide con la contraseña.';
    if (!terms) e.terms = 'Debes aceptar los términos.';
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const c = cleaned();
    const v = validate(c);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({
        email: c.email,
        password: c.password,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        accountType,
      });
      if (needsConfirmation) {
        setPendingEmail(c.email);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setSubmitError(
        friendlyError(err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle={`Te enviamos un enlace de confirmación a ${pendingEmail}.`}
      >
        <p className="text-sm text-slate-600">
          Haz clic en el enlace para activar tu cuenta
          {accountType === 'company'
            ? '. Como empresa proveedora, un administrador verificará tu cuenta antes de habilitar el panel.'
            : accountType === 'reseller'
              ? ' de revendedor y empezar a comprar por volumen.'
              : ' y empezar a explorar lotes.'}
        </p>
        <Link
          to="/login"
          className="mt-6 block text-center rounded-lg bg-brand-900 text-white font-semibold py-3 hover:bg-brand-700 transition"
        >
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    );
  }

  const input = (invalid: boolean) => (
    { 'aria-invalid': invalid } as const
  );

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Regístrate para comprar lotes verificados."
    >
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
          Falta configurar Supabase: copia <code>web/.env.example</code> a{' '}
          <code>web/.env</code> con la anon key del proyecto.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <span className="field-label">Tipo de cuenta</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de cuenta">
            {accountOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={accountType === o.value}
                title={o.text}
                onClick={() => setAccountType(o.value)}
                className={`rounded-lg border px-2 py-2.5 text-left transition ${
                  accountType === o.value
                    ? 'border-brand-900 bg-brand-900 text-white shadow'
                    : 'border-slate-300 bg-white text-brand-950 hover:border-brand-900'
                }`}
              >
                <span className="block text-xs font-bold leading-tight">
                  {o.title}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {accountOptions.find((o) => o.value === accountType)?.text}
            {accountType === 'company' &&
              ' La cuenta empresa requiere verificación de un administrador.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="firstName">
              Nombre
            </label>
            <input
              id="firstName"
              className="field-input"
              autoComplete="given-name"
              maxLength={LIMITS.name}
              placeholder="Ana"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              {...input(Boolean(errors.firstName))}
            />
            {errors.firstName && <p className="field-error">{errors.firstName}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="lastName">
              Apellido
            </label>
            <input
              id="lastName"
              className="field-input"
              autoComplete="family-name"
              maxLength={LIMITS.name}
              placeholder="García"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              {...input(Boolean(errors.lastName))}
            />
            {errors.lastName && <p className="field-error">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="regEmail">
            Correo electrónico
          </label>
          <input
            id="regEmail"
            type="email"
            className="field-input"
            autoComplete="email"
            maxLength={LIMITS.email}
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            {...input(Boolean(errors.email))}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="phone">
            Teléfono de contacto
          </label>
          <input
            id="phone"
            type="tel"
            className="field-input"
            autoComplete="tel"
            maxLength={LIMITS.phone}
            placeholder="+57 300 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            {...input(Boolean(errors.phone))}
          />
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="regPass">
              Contraseña
            </label>
            <input
              id="regPass"
              type="password"
              className="field-input"
              autoComplete="new-password"
              maxLength={LIMITS.password}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              {...input(Boolean(errors.password))}
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="confirm">
              Confirmar
            </label>
            <input
              id="confirm"
              type="password"
              className="field-input"
              autoComplete="new-password"
              maxLength={LIMITS.password}
              placeholder="Repite tu clave"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              {...input(Boolean(errors.confirm))}
            />
            {errors.confirm && <p className="field-error">{errors.confirm}</p>}
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="mt-1 accent-[#1a365d]"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          <span>
            Acepto los Términos y Condiciones y la Política de Privacidad de
            RecuperaPack.
          </span>
        </label>
        {errors.terms && <p className="field-error">{errors.terms}</p>}

        {submitError && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !configured}
          className="w-full rounded-lg bg-accent-500 text-white font-semibold py-3 hover:bg-accent-600 transition disabled:opacity-50"
        >
          {busy ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-brand-900 font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
