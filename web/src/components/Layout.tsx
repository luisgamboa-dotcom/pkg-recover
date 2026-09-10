import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';
import { useNotifications } from '../data/account';

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm font-medium ${isActive ? 'text-accent-500' : 'text-white/85 hover:text-white'}`;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { count } = useCart();
  const { unread } = useNotifications(user?.id);
  const navigate = useNavigate();
  const isAdmin = profile?.roleCode === 'admin';
  const isCompany = profile?.roleCode === 'company';

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col">
      <header className="bg-brand-900 text-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent-500 font-extrabold text-lg">
              R
            </span>
            <span className="font-extrabold tracking-tight hidden sm:inline">
              RecuperaPack
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/catalogo" className={navClass}>
              Catálogo
            </NavLink>
            <NavLink to="/pedidos" className={navClass}>
              Mis pedidos
            </NavLink>
            <NavLink to="/favoritos" className={navClass}>
              Favoritos
            </NavLink>
            <NavLink to="/ayuda" className={navClass}>
              Ayuda
            </NavLink>
            {user && (
              <NavLink to="/notificaciones" className={navClass}>
                Avisos{unread > 0 ? ` (${unread})` : ''}
              </NavLink>
            )}
            {user && (
              <NavLink to="/mensajes" className={navClass}>
                Mensajes
              </NavLink>
            )}
            {isCompany && (
              <NavLink to="/empresa" className={navClass}>
                Mi empresa
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <button
              onClick={() => navigate('/carrito')}
              className="relative rounded-lg border border-white/30 px-3 py-1.5 hover:bg-white/10"
              aria-label={`Carrito, ${count} unidades`}
            >
              🛒
              {count > 0 && (
                <span className="absolute -top-2 -right-2 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-accent-500 text-xs font-bold">
                  {count}
                </span>
              )}
            </button>
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
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-slate-500 flex flex-wrap gap-2 justify-between">
          <span>© 2026 RecuperaPack · Términos · Privacidad · Contacto</span>
          <span>Garantía Recupera en lotes verificados</span>
        </div>
      </footer>
    </div>
  );
}
