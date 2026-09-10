import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { RequireAdmin } from '../../components/RequireRole';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/format';
import { fetchRoles, fetchUsers, updateUser } from '../../data/admin';

export default function AdminUsers() {
  return (
    <RequireAdmin>
      <AdminLayout>
        <List />
      </AdminLayout>
    </RequireAdmin>
  );
}

function List() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ id: string; code: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetchUsers()
      .then(setUsers)
      .catch((err) => setMsg(err instanceof Error ? err.message : String(err)));

  useEffect(() => {
    void load();
    fetchRoles().then(setRoles).catch(() => undefined);
  }, []);

  async function change(id: string, patch: { role_id?: string; is_active?: boolean }) {
    try {
      await updateUser(id, patch);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Roles, permisos y activación." />
      {msg && <p className="mb-3 text-sm text-slate-700 bg-slate-100 border rounded-lg p-3">{msg}</p>}
      {users.length === 0 && <EmptyState title="Sin usuarios" text="Aparecen al registrarse." />}
      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
              <th className="p-3">Usuario</th><th className="p-3">Teléfono</th><th className="p-3">Rol</th>
              <th className="p-3">Estado</th><th className="p-3">Registro</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3 font-semibold">
                  {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  <span className="block text-xs font-mono font-normal text-slate-400">{u.id.slice(0, 8)}</span>
                </td>
                <td className="p-3">{u.phone ?? '—'}</td>
                <td className="p-3">
                  <select
                    className="field-input !w-auto !py-1"
                    value={u.roles?.code ?? ''}
                    onChange={(e) => {
                      const r = roles.find((x) => x.code === e.target.value);
                      if (r) void change(u.id, { role_id: r.id });
                    }}
                    aria-label="Rol del usuario"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.code}>{r.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => void change(u.id, { is_active: !u.is_active })}
                    className={`text-xs font-bold rounded-full px-2.5 py-1 ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-3 whitespace-nowrap">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Las cuentas empresa se elevan aquí tras verificarlas. La autenticación sigue en Supabase Auth.</p>
    </>
  );
}
