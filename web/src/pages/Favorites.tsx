import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { EmptyState, ProductCard, PageHeader } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { useFavoriteProducts } from '../data/shop';

export default function Favorites() {
  return (
    <ProtectedRoute>
      <List />
    </ProtectedRoute>
  );
}

function List() {
  const { user } = useAuth();
  const { products, loading, toggle } = useFavoriteProducts(user?.id);

  return (
    <Layout>
      <PageHeader title="Favoritos" subtitle="Tus productos guardados." />
      {loading && <p className="text-sm text-slate-500">Cargando…</p>}
      {!loading && products.length === 0 && (
        <EmptyState
          title="Sin favoritos"
          text="Marca ♡ en un producto para verlo aquí y enterarte de cambios."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="relative">
            <ProductCard product={product} />
            <button
              onClick={() => void toggle(product.id)}
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
