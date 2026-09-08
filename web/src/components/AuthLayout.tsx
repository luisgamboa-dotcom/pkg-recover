import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const bullets = [
  {
    title: 'Lotes verificados',
    text: 'Cada lote trae SKU, condición de empaque y reporte de estado.',
  },
  {
    title: 'Hasta −45% vs MSRP',
    text: 'Recupera valor de paquetes no reclamados a precio mayorista.',
  },
  {
    title: 'Trazabilidad total',
    text: 'Seguimiento del pedido desde la bodega hasta tu puerta.',
  },
];

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-50 flex flex-col lg:flex-row">
      {/* Panel de marca */}
      <aside className="lg:w-[44%] bg-brand-900 text-white flex flex-col justify-between p-8 lg:p-12">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent-500 font-extrabold text-xl text-white">
            R
          </span>
          <span className="leading-tight">
            <span className="block font-extrabold text-xl tracking-tight">
              RecuperaPack
            </span>
            <span className="block text-xs text-brand-100/80 tracking-widest uppercase">
              Plataforma de recuperación
            </span>
          </span>
        </Link>

        <div className="my-10 lg:my-0">
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Los paquetes perdidos
            <span className="text-accent-500"> dejan de serlo.</span>
          </h1>
          <ul className="mt-8 space-y-5">
            {bullets.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="mt-1 grid place-items-center w-6 h-6 shrink-0 rounded-full bg-success-600 text-white text-sm font-bold">
                  ✓
                </span>
                <span>
                  <span className="block font-semibold">{b.title}</span>
                  <span className="block text-sm text-brand-100/80">
                    {b.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-brand-100/60">
          © 2026 RecuperaPack · Términos · Privacidad
        </p>
      </aside>

      {/* Formulario */}
      <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-[0_10px_30px_rgba(26,54,93,0.08)] p-8">
          <h2 className="text-2xl font-bold tracking-tight text-brand-950">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
