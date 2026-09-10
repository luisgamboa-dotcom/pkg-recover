import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const links = [
  ['/admin', 'Tablero', true],
  ['/admin/lotes', 'Lotes'],
  ['/admin/inventario', 'Inventario'],
  ['/admin/paquetes', 'Paquetes'],
  ['/admin/pedidos', 'Pedidos'],
  ['/admin/empresas', 'Empresas'],
  ['/admin/usuarios', 'Usuarios'],
  ['/admin/catalogos', 'Catálogos'],
  ['/admin/reportes', 'Reportes'],
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-50 flex flex-col lg:flex-row">
      <aside className="lg:w-60 shrink-0 bg-brand-900 text-white p-4 lg:min-h-screen">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent-500 font-extrabold">
            R
          </span>
          <span className="font-extrabold text-sm">ADMIN PANEL</span>
        </Link>
        <nav className="mt-2 flex lg:flex-col gap-1 overflow-x-auto">
          {links.map(([to, label, exact]) => (
            <NavLink
              key={to}
              to={to}
              end={Boolean(exact)}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="block mt-4 px-3 text-xs text-white/60 hover:text-white">
          ← Volver a la tienda
        </Link>
      </aside>
      <main className="flex-1 p-4 lg:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
