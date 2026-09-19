import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  ROLE_NAMES,
  getExploreRole,
  isExplore,
  resetExplore,
  setExploreRole,
  type ExploreRole,
} from '../demo/demo';

/** Barra del modo exploración temporal: cambiar rol, restablecer o salir. */
export default function DemoBanner() {
  const { user, signOut } = useAuth();
  const active = isExplore() && !!user;
  // Reserva espacio bajo el footer SOLO mientras el banner existe.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '52px';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [active]);
  if (!active) return null;
  const role = getExploreRole();

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-brand-950 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="font-bold text-accent-500">MODO EXPLORACIÓN</span>
        <span className="text-white/70 hidden sm:inline">Ver como:</span>
        <div className="flex gap-1" role="group" aria-label="Rol de revisión">
          {(Object.keys(ROLE_NAMES) as ExploreRole[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setExploreRole(r);
                window.location.reload();
              }}
              aria-pressed={role === r}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                role === r ? 'bg-accent-500' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {ROLE_NAMES[r].split(' ')[0]}
            </button>
          ))}
        </div>
        <span className="ml-auto flex gap-2">
          <button
            onClick={() => {
              resetExplore();
              window.location.reload();
            }}
            className="underline text-white/70 hover:text-white"
          >
            Restablecer datos
          </button>
          <button
            onClick={() => void signOut()}
            className="underline text-white/70 hover:text-white"
          >
            Salir
          </button>
        </span>
      </div>
    </div>
  );
}
