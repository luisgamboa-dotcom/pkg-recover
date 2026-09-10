import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { configured, loading, user } = useAuth();
  if (loading) {
    return <p className="text-sm text-slate-500">Cargando sesión…</p>;
  }
  if (!configured || !user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
