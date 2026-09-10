import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import ProtectedRoute from './ProtectedRoute';

export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleCheck allowed={['admin']}>{children}</RoleCheck>
    </ProtectedRoute>
  );
}

export function RequireCompany({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RoleCheck allowed={['company', 'admin']}>{children}</RoleCheck>
    </ProtectedRoute>
  );
}

function RoleCheck({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const { loading, profile } = useAuth();
  if (loading || !profile) {
    return <p className="text-sm text-slate-500">Verificando permisos…</p>;
  }
  if (!allowed.includes(profile.roleCode)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
