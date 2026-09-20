import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';
import { useNotifications } from '../data/account';
import Footer from './Footer';
import MobileNav from './MobileNav';

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium ${isActive ? 'text-accent-500' : 'text-white/85 hover:text-white'}`;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { count } = useCart();
  const { unread } = useNotifications(user?.id);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = profile?.roleCode === 'admin';
  const isCompany = profile?.roleCode === 'company';

  const menuLinks = [
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/pedidos', label: 'Mis pedidos' },
    { to: '/favoritos', label: 'Favoritos' },
    { to: '/ayuda', label: 'Ayuda' },
    ...(user ? [{ to: '/notificaciones', label: `Avisos${unread > 0 ? ` (${unread})` : ''}` }] : []),
    ...(user ? [{ to: '/mensajes', label: 'Mensajes' }] : []),
    ...(isCompany ? [{ to: '/empresa', label: 'Mi empresa' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-dvh bg-brand-50 flex flex-col">
      <header className="bg-brand-900 text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-x-6 gap-y-2 flex-wrap">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500 font-extrabold text-lg">
              R
            </span>
            <span className="font-extrabold tracking-tight hidden sm:inline">
              RecuperaPack
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-x-4 gap-y-1 flex-wrap" aria-label="Principal">
            {menuLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 text-sm">
            <button
              onClick={() => navigate('/carrito')}
              className="relative rounded-lg border border-white/30 min-w-[44px] min-h-[44px] grid place-items-center px-3 hover:bg-white/10"
              aria-label={`Carrito, ${count} unidades`}
            >
              🛒
              {count > 0 && (
                <span className="absolute -top-2 -right-2 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-accent-500 text-xs font-bold">
                  {count}
                </span>
              )}
            </button>
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <NavLink to="/cuenta" className={navClass}>
                  Mi cuenta
                </NavLink>
              ) : (
                <>
                  <NavLink to="/login" className={navClass}>
                    Ingresar
                  </NavLink>
                  <NavLink
                    to="/registro"
                    className="rounded-lg bg-accent-500 px-3 py-1.5 font-semibold hover:bg-accent-600"
                  >
                    Crear cuenta
                  </NavLink>
                </>
              )}
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="md:hidden rounded-lg border border-white/30 min-w-[44px] min-h-[44px] grid place-items-center text-lg hover:bg-white/10"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="md:hidden border-t border-white/10 px-6 py-3 flex flex-col" aria-label="Móvil">
            {menuLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `py-3 border-b border-white/5 text-[15px] font-medium last:border-0 ${
                    isActive ? 'text-accent-500' : 'text-white/90'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <NavLink
                to="/cuenta"
                onClick={() => setMenuOpen(false)}
                className="py-3 text-[15px] font-semibold text-accent-500"
              >
                Mi cuenta
              </NavLink>
            ) : (
              <div className="flex gap-3 py-3">
                <NavLink
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center rounded-lg border border-white/30 py-3 font-semibold"
                >
                  Ingresar
                </NavLink>
                <NavLink
                  to="/registro"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 text-center rounded-lg bg-accent-500 py-3 font-semibold"
                >
                  Crear cuenta
                </NavLink>
              </div>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 md:pb-8">{children}</main>

      <Footer />
      <MobileNav />
    </div>
  );
}
