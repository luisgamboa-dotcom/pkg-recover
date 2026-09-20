import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../lib/cart';

/**
 * Barra inferior para móvil (inicio, catálogo, carrito, pedidos, cuenta).
 * Solo <md. Respeta el safe-area de iPhone con notch/gestos.
 */
export default function MobileNav() {
  const { user } = useAuth();
  const { count } = useCart();

  const tabs = [
    { to: '/', label: 'Inicio', icon: '🏠', end: true, badge: 0 },
    { to: '/catalogo', label: 'Catálogo', icon: '🛍️', end: false, badge: 0 },
    { to: '/carrito', label: 'Carrito', icon: '🛒', end: false, badge: count },
    { to: '/pedidos', label: 'Pedidos', icon: '📦', end: false, badge: 0 },
    {
      to: user ? '/cuenta' : '/login',
      label: user ? 'Cuenta' : 'Ingresar',
      icon: '👤',
      end: false,
      badge: 0,
    },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 min-h-[60px] py-2 text-[11px] font-semibold ${
                isActive ? 'text-accent-600' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
            {t.badge > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-5 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-accent-500 text-white text-[11px] font-bold">
                {t.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
