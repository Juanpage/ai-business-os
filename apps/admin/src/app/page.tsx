'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Metrics } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'En prueba',
  active: 'Activas',
  past_due: 'Con mora',
  cancelled: 'Canceladas',
  expired: 'Expiradas',
};

export default function DashboardPage() {
  const { admin, ready } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !admin) return;
    apiFetch<Metrics>('/admin/metrics')
      .then(setMetrics)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando metricas'));
  }, [ready, admin]);

  return (
    <AdminShell>
      <h2 className="mb-6 text-lg font-semibold text-gray-900">Resumen de la plataforma</h2>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!metrics && !error && <p className="text-sm text-gray-500">Cargando...</p>}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="MRR"
            value={`$${metrics.mrr.toFixed(2)}`}
            hint="Ingreso mensual recurrente"
            highlight
          />
          <StatCard
            label="Tenants"
            value={String(metrics.tenants.total)}
            hint={`${metrics.tenants.active} activos`}
          />
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Suscripciones
            </p>
            <ul className="mt-2 space-y-1">
              {Object.entries(metrics.subscriptionsByStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between text-sm">
                  <span className="text-gray-600">{STATUS_LABELS[status] ?? status}</span>
                  <span className="font-medium text-gray-900">{count}</span>
                </li>
              ))}
              {Object.keys(metrics.subscriptionsByStatus).length === 0 && (
                <li className="text-sm text-gray-400">Sin suscripciones.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 shadow-sm ring-1 ${
        highlight ? 'bg-gray-900 ring-gray-900' : 'bg-white ring-gray-200'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          highlight ? 'text-gray-400' : 'text-gray-500'
        }`}
      >
        {label}
      </p>
      <p className={`mt-1 text-3xl font-semibold ${highlight ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`mt-1 text-xs ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>{hint}</p>
    </div>
  );
}
