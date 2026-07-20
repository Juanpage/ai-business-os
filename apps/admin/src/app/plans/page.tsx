'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { Modal } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Plan } from '@/lib/types';

interface FormState {
  name: string;
  code: string;
  description: string;
  price: string;
  interval: 'monthly' | 'yearly';
  trialDays: string;
  maxVenues: string;
  maxUsers: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  description: '',
  price: '',
  interval: 'monthly',
  trialDays: '0',
  maxVenues: '',
  maxUsers: '',
};

export default function PlansPage() {
  const { admin, ready } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans(await apiFetch<Plan[]>('/admin/plans'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando planes');
    }
  }, []);

  useEffect(() => {
    if (ready && admin) void load();
  }, [ready, admin, load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal({ id: null });
  }

  function openEdit(p: Plan) {
    setForm({
      name: p.name,
      code: p.code,
      description: p.description ?? '',
      price: String(Number(p.price)),
      interval: p.interval,
      trialDays: String(p.trialDays),
      maxVenues: p.maxVenues == null ? '' : String(p.maxVenues),
      maxUsers: p.maxUsers == null ? '' : String(p.maxUsers),
    });
    setModal({ id: p.id });
  }

  async function save() {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        ...(modal.id ? {} : { code: form.code }),
        ...(form.description ? { description: form.description } : {}),
        price: Number(form.price),
        interval: form.interval,
        trialDays: Number(form.trialDays || 0),
        ...(form.maxVenues !== '' ? { maxVenues: Number(form.maxVenues) } : {}),
        ...(form.maxUsers !== '' ? { maxUsers: Number(form.maxUsers) } : {}),
      };

      await apiFetch(modal.id ? `/admin/plans/${modal.id}` : '/admin/plans', {
        method: modal.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function doRemove() {
    if (!confirm) return;
    setError(null);
    try {
      await apiFetch(`/admin/plans/${confirm}`, { method: 'DELETE' });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
      setConfirm(null);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Planes ({plans.length})</h2>
        <button
          onClick={openCreate}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Plan
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">{p.code}</p>
              </div>
              <p className="text-xl font-semibold text-gray-900">
                ${Number(p.price).toFixed(0)}
                <span className="text-xs font-normal text-gray-500">
                  /{p.interval === 'monthly' ? 'mes' : 'año'}
                </span>
              </p>
            </div>
            {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              <li>Locales: {p.maxVenues ?? 'Ilimitados'}</li>
              <li>Usuarios: {p.maxUsers ?? 'Ilimitados'}</li>
              <li>Prueba: {p.trialDays > 0 ? `${p.trialDays} dias` : 'Sin prueba'}</li>
            </ul>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => openEdit(p)}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirm(p.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Borrar
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && <p className="text-sm text-gray-400">Sin planes.</p>}
      </div>

      {modal && (
        <Modal title={modal.id ? 'Editar plan' : 'Nuevo plan'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <Field label="Nombre">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            {!modal.id && (
              <Field label="Codigo (unico, ej. pro)">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            )}
            <Field label="Descripcion">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Intervalo">
                <select
                  value={form.interval}
                  onChange={(e) =>
                    setForm({ ...form, interval: e.target.value as FormState['interval'] })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Dias de prueba">
                <input
                  type="number"
                  min="0"
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Max. locales">
                <input
                  type="number"
                  min="1"
                  placeholder="∞"
                  value={form.maxVenues}
                  onChange={(e) => setForm({ ...form, maxVenues: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Max. usuarios">
                <input
                  type="number"
                  min="1"
                  placeholder="∞"
                  value={form.maxUsers}
                  onChange={(e) => setForm({ ...form, maxUsers: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title="Confirmar eliminacion" onClose={() => setConfirm(null)}>
          <p className="text-sm text-gray-600">
            No se puede eliminar un plan con suscripciones vigentes.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setConfirm(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={doRemove}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
