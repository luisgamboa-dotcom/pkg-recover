import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthLayout from '../components/AuthLayout';

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message))
    return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message))
    return 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja.';
  if (/too many requests/i.test(message))
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  return message;
}

export default function Login() {
  const { configured, signIn, sendPasswordReset, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Escribe tu correo arriba para enviarte el enlace.');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordReset(email.trim());
      setInfo('Te enviamos un enlace para restablecer tu contraseña.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Accede a tus pedidos, favoritos y seguimiento."
    >
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
          Falta configurar Supabase: copia <code>web/.env.example</code> a{' '}
          <code>web/.env</code> con la anon key del proyecto.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <label className="field-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="field-input"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !configured}
          className="w-full rounded-lg bg-brand-900 text-white font-semibold py-3 hover:bg-brand-700 transition disabled:opacity-50"
        >
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onForgot}
          disabled={resetting}
          className="text-brand-900 font-medium hover:underline disabled:opacity-50"
        >
          {resetting ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
        </button>
        <Link to="/registro" className="text-accent-600 font-semibold hover:underline">
          Crear cuenta
        </Link>
      </div>
    </AuthLayout>
  );
}
