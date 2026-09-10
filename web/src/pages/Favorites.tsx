import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, LotCard, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useFavoriteLots } from '../data/shop';

export default function Favorites() {
  return (
    <ProtectedRoute>
      <List />
    </ProtectedRoute>
  );
}

function List() {
  const { user } = useAuth();
  const { lots, loading, toggle } = useFavoriteLots(user?.id);

  return (
    <Layout>
      <PageHeader title="Favoritos" subtitle="Tus lotes guardados." />
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && lots.length === 0 && (
        <EmptyState
          title="Sin favoritos"
          text="Marca ♡ en un lote para verlo aquí y enterarte de cambios."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {lots.map((lot) => (
          <div key={lot.id} className="relative">
            <LotCard lot={lot} />
            <button
              onClick={() => void toggle(lot.id)}
              className="absolute top-2 right-2 text-xs font-bold bg-white/90 border border-slate-200 rounded-full px-2.5 py-1 hover:border-accent-500 hover:text-accent-600"
            >
              Quitar ♥
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
