import { useAuth } from '../auth/AuthContext';
import {
  ROLE_NAMES,
  getDemoRole,
  isDemo,
  resetDemo,
  setDemoRole,
  type DemoRole,
} from '../demo/demo';

/** Barra de modo prueba: cambiar rol, restablecer datos o salir. */
export default function DemoBanner() {
  const { user, signOut } = useAuth();
  if (!isDemo() || !user) return null;
  const role = getDemoRole();

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-brand-950 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="font-bold text-accent-500">MODO DEMO</span>
        <span className="text-white/70 hidden sm:inline">Ver como:</span>
        <div className="flex gap-1" role="group" aria-label="Rol de prueba">
          {(Object.keys(ROLE_NAMES) as DemoRole[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setDemoRole(r);
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
              resetDemo();
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
            Salir del demo
          </button>
        </span>
      </div>
    </div>
  );
}
