import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import Footer from '../components/Footer';
import MobileNav from '../components/MobileNav';
import { LotCard } from '../components/ui';
import { emptyFilters, useCatalog, useCategories } from '../data/shop';

const STEPS = [
  {
    n: '1',
    title: 'Recuperamos',
    text: 'Rescatamos paquetes extraviados o no reclamados y objetos que las personas ya no usan, antes de que terminen en la basura.',
  },
  {
    n: '2',
    title: 'Verificamos',
    text: 'Clasificamos, evaluamos el estado y publicamos cada lote con fotos, SKU y descuento frente al precio de referencia.',
  },
  {
    n: '3',
    title: 'Tú ahorras',
    text: 'Compras lotes verificados con garantía, seguimiento total y precios hasta 45% bajo la referencia.',
  },
];

export default function Home() {
  const { user, profile, signOut } = useAuth();
  const categories = useCategories();
  const { lots } = useCatalog(emptyFilters);
  const featured = lots.filter((l) => l.is_featured).slice(0, 4);

  return (
    <div className="min-h-dvh bg-brand-50">
      {/* Header */}
      <header className="bg-brand-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 font-extrabold text-lg shadow">
              R
            </span>
            <span className="font-extrabold tracking-tight">RecuperaPack</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/catalogo" className="hover:underline hidden sm:inline">
              Catálogo
            </Link>
            <Link to="/ayuda" className="hover:underline hidden sm:inline">
              Ayuda
            </Link>
            {user ? (
              <>
                <span className="text-brand-100/80 hidden md:inline">
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
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-[#4c2a85] text-white">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-success-600/20 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-20">
          <span className="inline-block text-xs font-bold uppercase tracking-widest bg-white/10 border border-white/15 rounded-full px-3 py-1">
            ♻️ Economía circular · Chile
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            Lo que otros desechan,
            <span className="bg-gradient-to-r from-accent-500 to-amber-300 bg-clip-text text-transparent">
              {' '}tú lo aprovechas.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-brand-100/90 text-lg">
            Recuperamos paquetes extraviados y objetos que las personas ya no
            quieren usar, los verificamos y los convertimos en lotes con
            descuento. Menos desecho, más ahorro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/catalogo"
              className="rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 px-6 py-3 font-bold shadow-lg shadow-accent-500/30 hover:brightness-110 transition"
            >
              Explorar catálogo
            </Link>
            <Link
              to="/ayuda"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold hover:bg-white/10 transition"
            >
              Vende lo que ya no usas
            </Link>
          </div>
          <dl className="mt-10 grid grid-cols-3 max-w-lg gap-4">
            {[
              ['−45%', 'vs precio de referencia'],
              ['8', 'categorías'],
              ['19%', 'IVA incluido en caja'],
            ].map(([n, label]) => (
              <div key={label} className="rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur">
                <dd className="text-2xl font-extrabold">{n}</dd>
                <dd className="text-xs text-brand-100/75 uppercase tracking-wider mt-1">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-gradient-to-b from-white to-brand-50">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-accent-600">
            Cómo funciona
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-950">
            Del desecho a tus manos en 3 pasos
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <article
                key={s.n}
                className="rounded-2xl bg-white border border-slate-200 p-6 shadow-[0_10px_30px_rgba(26,54,93,0.08)]"
              >
                <span className="inline-grid place-items-center w-10 h-10 rounded-full bg-gradient-to-br from-brand-900 to-[#4c2a85] text-white font-extrabold">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-bold text-brand-950">{s.title}</h3>
                <p className="mt-1.5 text-slate-600">{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Para quiénes */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-3xl font-extrabold tracking-tight text-brand-950 text-center">
          Hecho para empresas y para personas
        </h2>
        <p className="mt-2 text-slate-600 text-center max-w-2xl mx-auto">
          No solo trabajamos con empresas: si tienes objetos que ya no usas,
          también pueden tener una segunda vida aquí.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl p-6 text-white bg-gradient-to-br from-brand-900 to-brand-700 shadow-lg">
            <h3 className="text-xl font-bold">🏢 Empresas proveedoras</h3>
            <p className="mt-2 text-brand-100/90">
              Entregan paquetes no reclamados y recuperan su valor económico
              con reportes de trazabilidad por lote vendido.
            </p>
            <Link
              to="/registro"
              className="mt-4 inline-block rounded-lg bg-white text-brand-900 font-semibold px-5 py-2.5 hover:bg-brand-50"
            >
              Registrar empresa
            </Link>
          </article>
          <article className="rounded-2xl p-6 text-white bg-gradient-to-br from-accent-600 to-accent-500 shadow-lg shadow-accent-500/25">
            <h3 className="text-xl font-bold">📦 Personas que desechan</h3>
            <p className="mt-2 text-white/90">
              ¿Muebles, ropa, electrónica que ya no quieres? Contáctanos y
              evaluamos recibirlos para darles una segunda vida.
            </p>
            <Link
              to="/ayuda"
              className="mt-4 inline-block rounded-lg bg-white text-accent-600 font-semibold px-5 py-2.5 hover:bg-accent-100"
            >
              Ofrecer mis objetos
            </Link>
          </article>
        </div>
      </section>

      {/* Categorías */}
      {categories.length > 0 && (
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-end justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">
                Explora por categoría
              </h2>
              <Link to="/catalogo" className="text-sm font-semibold text-accent-600 hover:underline">
                Ver todo →
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to="/catalogo"
                  className="rounded-full border border-slate-300 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900 hover:border-brand-900 hover:shadow transition"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Destacados */}
      {featured.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight text-brand-950">
              Lotes destacados
            </h2>
            <Link to="/catalogo" className="text-sm font-semibold text-accent-600 hover:underline">
              Ver catálogo →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
            ))}
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="rounded-3xl bg-gradient-to-r from-brand-900 via-[#3b2d6e] to-brand-900 text-white p-8 lg:p-12 text-center shadow-xl">
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
            Cada compra evita kilos de desecho 🌎
          </h2>
          <p className="mt-2 text-brand-100/85 max-w-xl mx-auto">
            Únete a la vitrina circular: compra verificado o entrega lo que ya
            no uses. Garantía Recupera en cada lote.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!user && (
              <Link
                to="/registro"
                className="rounded-xl bg-white text-brand-900 font-bold px-6 py-3 hover:bg-brand-50"
              >
                Crear cuenta gratis
              </Link>
            )}
            <Link
              to="/catalogo"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold hover:bg-white/10"
            >
              Ver lotes
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      <div className="h-16 md:hidden" aria-hidden="true" />
      <MobileNav />
    </div>
  );
}
