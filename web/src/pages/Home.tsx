import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type Status = 'done' | 'waiting' | 'next';

const features: { title: string; text: string; status: Status }[] = [
  {
    title: 'Inicio de sesión',
    text: 'Email + contraseña con Supabase Auth, errores en español y recuperación de clave por correo.',
    status: 'done',
  },
  {
    title: 'Registro con roles',
    text: 'Cliente, revendedor o empresa. El rol se asigna al crear la cuenta (empresa queda pendiente de verificación admin).',
    status: 'done',
  },
  {
    title: 'Sesión y perfil',
    text: 'Sesión persistente, perfil con rol desde la base de datos y cierre de sesión.',
    status: 'done',
  },
  {
    title: 'Base de datos normalizada',
    text: '29 tablas 1NF–3NF: paquetes → lotes → pedidos, categorías N:M, inventario, despachos, reseñas, soporte y más.',
    status: 'done',
  },
  {
    title: 'Seguridad por rol (RLS)',
    text: 'Políticas para cliente, revendedor, empresa y admin. Sin contraseñas en tablas propias.',
    status: 'done',
  },
  {
    title: 'Aplicar migraciones en Supabase',
    text: 'Los 3 archivos SQL están validados. Falta reiniciar opencode para reconectar el MCP y ejecutarlos.',
    status: 'waiting',
  },
];

const roadmap: { title: string; text: string }[] = [
  {
    title: 'Catálogo y detalle de lote',
    text: 'Búsqueda, filtros por categoría/precio/marca/estado y ficha del lote.',
  },
  {
    title: 'Carrito y compra',
    text: 'Carrito, checkout con dirección y pago, IVA 19% y número de pedido.',
  },
  {
    title: 'Mis pedidos y seguimiento',
    text: 'Historial, estados y tracking del despacho con transportadora.',
  },
  {
    title: 'Paneles admin y empresa',
    text: 'Gestión de lotes, inventario, paquetes, pedidos, empresas y reportes.',
  },
];

function StatusBadge({ status }: { status: Status }) {
  if (status === 'done')
    return (
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded-full px-3 py-1">
        Listo
      </span>
    );
  if (status === 'waiting')
    return (
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 rounded-full px-3 py-1">
        Pendiente de reinicio
      </span>
    );
  return (
    <span className="inline-block text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-200 rounded-full px-3 py-1">
      Próximo
    </span>
  );
}

export default function Home() {
  const { configured, user, profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-brand-50">
      {/* Header */}
      <header className="bg-brand-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500 font-extrabold text-lg">
              R
            </span>
            <span className="font-extrabold tracking-tight">RecuperaPack</span>
          </span>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="text-brand-100/80 hidden sm:inline">
                  {user.email} · {profile?.roleName ?? '…'}
                </span>
                <button
                  onClick={() => void signOut()}
                  className="rounded-lg border border-white/30 px-3 py-1.5 hover:bg-white/10"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:underline">
                  Ingresar
                </Link>
                <Link
                  to="/registro"
                  className="rounded-lg bg-accent-500 px-4 py-2 font-semibold hover:bg-accent-600"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-brand-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <span className="inline-block text-xs font-bold uppercase tracking-widest bg-white/10 rounded-full px-3 py-1">
            MVP en construcción · Sección 1 y 2 parcial
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Los paquetes perdidos
            <span className="text-accent-500"> dejan de serlo.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-brand-100/85">
            Plataforma para recuperar el valor de paquetes extraviados o no
            reclamados: lotes verificados con descuento, trazabilidad total y
            paneles para clientes, revendedores, empresas y administradores.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <span className="rounded-lg bg-success-600 px-5 py-3 font-semibold">
                Sesión activa como {profile?.roleName ?? 'usuario'}
              </span>
            ) : (
              <>
                <Link
                  to="/registro"
                  className="rounded-lg bg-accent-500 px-5 py-3 font-semibold hover:bg-accent-600"
                >
                  Crear cuenta
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10"
                >
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
          <dl className="mt-8 grid grid-cols-3 max-w-md gap-4">
            {[
              ['29', 'tablas BD'],
              ['3', 'migraciones SQL'],
              ['4', 'roles y RLS'],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-extrabold">{n}</dd>
                <dd className="text-xs text-brand-100/70 uppercase tracking-wider">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {!configured && (
        <div className="max-w-6xl mx-auto px-6 mt-6">
          <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4">
            Falta configurar Supabase: copia <code>web/.env.example</code> a{' '}
            <code>web/.env</code> con la anon key del proyecto
            (Dashboard → Project Settings → API).
          </p>
        </div>
      )}

      {/* Funciones agregadas */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold tracking-tight text-brand-950">
          Funciones agregadas hasta ahora
        </h2>
        <p className="mt-1 text-slate-600">
          Autenticación completa y base de datos lista para aplicar.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_4px_12px_rgba(26,54,93,0.06)]"
            >
              <StatusBadge status={f.status} />
              <h3 className="mt-3 font-bold text-brand-950">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </article>
          ))}
        </div>

        {/* Avance / roadmap */}
        <h2 className="mt-12 text-2xl font-bold tracking-tight text-brand-950">
          Lo que sigue
        </h2>
        <p className="mt-1 text-slate-600">
          Requiere tu autorización para continuar, como acordamos por secciones.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {roadmap.map((r, i) => (
            <article
              key={r.title}
              className="bg-white rounded-2xl border border-dashed border-slate-300 p-5"
            >
              <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-brand-100 text-brand-900 text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-3 font-bold text-brand-950">{r.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{r.text}</p>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-wrap gap-2 justify-between">
          <span>© 2026 RecuperaPack · Plataforma de recuperación de paquetes</span>
          <span>Bun · Vite · React · Supabase · Tailwind</span>
        </div>
      </footer>
    </div>
  );
}
