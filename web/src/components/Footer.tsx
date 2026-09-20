import { Link } from 'react-router-dom';

/**
 * Pie de página común a todas las secciones.
 * - "Nosotros": sección aún no creada → casilla vacía (ver TO DO.txt).
 * - Redes sociales con URLs provisorias (ver TO DO.txt).
 */
const SOCIAL = [
  { name: 'Instagram', href: 'https://instagram.com/recuperapack' },
  { name: 'Facebook', href: 'https://facebook.com/recuperapack' },
  { name: 'X', href: 'https://x.com/recuperapack' },
];

export default function Footer() {
  return (
    <footer className="bg-brand-950 text-white mt-8">
      <div className="max-w-6xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent-500 text-base">
              R
            </span>
            RecuperaPack
          </p>
          <p className="mt-2 text-sm text-white/70">
            Plataforma de recuperación de paquetes: lotes verificados con
            descuento y trazabilidad total.
          </p>
        </div>
        <nav aria-label="Nosotros">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            Nosotros
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <Link to="/nosotros" className="text-white/85 hover:text-white hover:underline">
                Quiénes somos
              </Link>
            </li>
            <li>
              <Link to="/nosotros" className="text-white/85 hover:text-white hover:underline">
                Qué aportamos
              </Link>
            </li>
            <li>
              <Link to="/nosotros" className="text-white/85 hover:text-white hover:underline">
                Cómo lo hacemos
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            Ayuda
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <Link to="/ayuda" className="text-white/85 hover:text-white hover:underline">
                Centro de ayuda
              </Link>
            </li>
            <li>
              <Link to="/ayuda" className="text-white/85 hover:text-white hover:underline">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/cuenta" className="text-white/85 hover:text-white hover:underline">
                Mi cuenta
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            Síguenos
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {SOCIAL.map((s) => (
              <li key={s.name}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/85 hover:text-white hover:underline"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-white/50 flex flex-wrap gap-2 justify-between">
          <span>© 2026 RecuperaPack · Términos · Privacidad</span>
          <span>Garantía Recupera en lotes verificados</span>
        </div>
      </div>
    </footer>
  );
}
