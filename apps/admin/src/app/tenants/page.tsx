'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { TenantRow } from '@/lib/types';

export default function TenantsPage() {
  const { admin, ready } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTenants(await apiFetch<TenantRow[]>('/admin/tenants'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando tenants');
    }
  }, []);

  useEffect(() => {
    if (ready && admin) void load();
  }, [ready, admin, load]);

  async function toggleStatus(t: TenantRow) {
    setBusy(t.id);
    setError(null);
    try {
      await apiFetch(`/admin/tenants/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: t.status === 'suspended' ? 'active' : 'suspended' }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Tenants ({tenants.length})</h2>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Locales</th>
              <th className="px-4 py-3">Usuarios</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {t.plan ? `${t.plan.name} ($${Number(t.plan.price).toFixed(0)})` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700">{t.venues}</td>
                <td className="px-4 py-3 text-gray-700">{t.users}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleStatus(t)}
                    disabled={busy === t.id}
                    className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
                      t.status === 'suspended'
                        ? 'border-green-300 text-green-700 hover:bg-green-50'
                        : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {t.status === 'suspended' ? 'Reactivar' : 'Suspender'}
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Sin tenants.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
