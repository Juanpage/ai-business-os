'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Customer, Reservation, Table, Venue } from '@/lib/types';

type Tab = 'tables' | 'customers' | 'reservations';
type Entity = 'table' | 'customer' | 'reservation';

interface FormState {
  venueId: string;
  code: string;
  status: string;
  fullName: string;
  email: string;
  phone: string;
  documentId: string;
  customerId: string;
  tableId: string;
  reservedAt: string;
  partySize: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  venueId: '',
  code: '',
  status: '',
  fullName: '',
  email: '',
  phone: '',
  documentId: '',
  customerId: '',
  tableId: '',
  reservedAt: '',
  partySize: '2',
  notes: '',
};

const TABLE_STATUS = ['available', 'occupied', 'reserved', 'disabled'];
const RESERVATION_STATUS = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show', 'completed'];

// ISO (UTC) -> valor para <input type="datetime-local"> (hora local).
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function OperationsPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [tab, setTab] = useState<Tab>('tables');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<{ entity: Entity; id: string | null } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ entity: Entity; id: string } | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [v, t, c, r] = await Promise.all([
        apiFetch<Venue[]>('/venues'),
        apiFetch<Table[]>('/tables'),
        apiFetch<Customer[]>('/customers'),
        apiFetch<Reservation[]>('/reservations'),
      ]);
      setVenues(v);
      setTables(t);
      setCustomers(c);
      setReservations(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    }
  }, []);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  const entityForTab = (t: Tab): Entity =>
    t === 'tables' ? 'table' : t === 'customers' ? 'customer' : 'reservation';

  function openCreate() {
    const entity = entityForTab(tab);
    const base = { ...EMPTY_FORM, venueId: venues[0]?.id ?? '' };
    if (entity === 'table') base.status = 'available';
    if (entity === 'reservation') base.status = 'pending';
    setForm(base);
    setModal({ entity, id: null });
  }

  function openEditTable(t: Table) {
    setForm({ ...EMPTY_FORM, venueId: t.venueId, code: t.code, status: t.status });
    setModal({ entity: 'table', id: t.id });
  }
  function openEditCustomer(c: Customer) {
    setForm({
      ...EMPTY_FORM,
      venueId: c.venueId ?? '',
      fullName: c.fullName,
      email: c.email ?? '',
      phone: c.phone ?? '',
      documentId: c.documentId ?? '',
    });
    setModal({ entity: 'customer', id: c.id });
  }
  function openEditReservation(r: Reservation) {
    setForm({
      ...EMPTY_FORM,
      venueId: r.venueId,
      customerId: r.customerId ?? '',
      tableId: r.tableId ?? '',
      reservedAt: toDatetimeLocal(r.reservedAt),
      partySize: String(r.partySize),
      notes: r.notes ?? '',
      status: r.status,
    });
    setModal({ entity: 'reservation', id: r.id });
  }

  // Mesas del venue seleccionado en el form (para reservas).
  const formVenueTables = useMemo(
    () => tables.filter((t) => t.venueId === form.venueId),
    [tables, form.venueId],
  );

  async function save() {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      let path = '';
      let body: Record<string, unknown> = {};

      if (modal.entity === 'table') {
        body = modal.id
          ? { code: form.code, status: form.status }
          : { venueId: form.venueId, code: form.code, status: form.status };
        path = modal.id ? `/tables/${modal.id}` : '/tables';
      } else if (modal.entity === 'customer') {
        body = {
          fullName: form.fullName,
          ...(form.email ? { email: form.email } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.documentId ? { documentId: form.documentId } : {}),
          ...(form.venueId ? { venueId: form.venueId } : {}),
        };
        path = modal.id ? `/customers/${modal.id}` : '/customers';
      } else {
        const reservedAtIso = form.reservedAt ? new Date(form.reservedAt).toISOString() : undefined;
        const common = {
          partySize: Number(form.partySize),
          ...(form.customerId ? { customerId: form.customerId } : {}),
          ...(form.tableId ? { tableId: form.tableId } : {}),
          ...(form.notes ? { notes: form.notes } : {}),
          status: form.status,
          ...(reservedAtIso ? { reservedAt: reservedAtIso } : {}),
        };
        body = modal.id ? common : { venueId: form.venueId, ...common };
        path = modal.id ? `/reservations/${modal.id}` : '/reservations';
      }

      await apiFetch(path, { method: modal.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
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
    const map: Record<Entity, string> = {
      table: '/tables',
      customer: '/customers',
      reservation: '/reservations',
    };
    setError(null);
    try {
      await apiFetch(`${map[confirm.entity]}/${confirm.id}`, { method: 'DELETE' });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
      setConfirm(null);
    }
  }

  if (!ready || !user) return null;

  const venueName = (id: string | null) =>
    id ? (venues.find((v) => v.id === id)?.name ?? '—') : '—';
  const customerName = (id: string | null) =>
    id ? (customers.find((c) => c.id === id)?.fullName ?? '—') : '—';
  const tableCode = (id: string | null) =>
    id ? (tables.find((t) => t.id === id)?.code ?? '—') : '—';

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Operacion</h1>
          </div>
          <button
            onClick={openCreate}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + {tab === 'tables' ? 'Mesa' : tab === 'customers' ? 'Cliente' : 'Reserva'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex gap-2">
          {(['tables', 'customers', 'reservations'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
              }`}
            >
              {t === 'tables' ? 'Mesas' : t === 'customers' ? 'Clientes' : 'Reservas'}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {tab === 'tables' && (
          <ul className="space-y-2">
            {tables.map((t) => (
              <Row
                key={t.id}
                title={`Mesa ${t.code}`}
                subtitle={`${venueName(t.venueId)} · ${t.status}`}
                onEdit={() => openEditTable(t)}
                onDelete={() => setConfirm({ entity: 'table', id: t.id })}
              />
            ))}
            {tables.length === 0 && <li className="text-sm text-gray-400">Sin mesas.</li>}
          </ul>
        )}

        {tab === 'customers' && (
          <ul className="space-y-2">
            {customers.map((c) => (
              <Row
                key={c.id}
                title={c.fullName}
                subtitle={[c.email, c.phone, c.documentId].filter(Boolean).join(' · ') || '—'}
                onEdit={() => openEditCustomer(c)}
                onDelete={() => setConfirm({ entity: 'customer', id: c.id })}
              />
            ))}
            {customers.length === 0 && <li className="text-sm text-gray-400">Sin clientes.</li>}
          </ul>
        )}

        {tab === 'reservations' && (
          <ul className="space-y-2">
            {reservations.map((r) => (
              <Row
                key={r.id}
                title={`${customerName(r.customerId)} · ${r.partySize}p`}
                subtitle={`${new Date(r.reservedAt).toLocaleString()} · ${venueName(r.venueId)} · Mesa ${tableCode(r.tableId)} · ${r.status}`}
                onEdit={() => openEditReservation(r)}
                onDelete={() => setConfirm({ entity: 'reservation', id: r.id })}
              />
            ))}
            {reservations.length === 0 && <li className="text-sm text-gray-400">Sin reservas.</li>}
          </ul>
        )}
      </div>

      {modal && (
        <Modal
          title={`${modal.id ? 'Editar' : 'Nueva'} ${modal.entity === 'table' ? 'mesa' : modal.entity === 'customer' ? 'cliente' : 'reserva'}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            {modal.entity === 'table' && (
              <>
                <Field label="Local">
                  <select
                    value={form.venueId}
                    onChange={(e) => setForm({ ...form, venueId: e.target.value })}
                    disabled={!!modal.id}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  >
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Codigo">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Estado">
                  <SelectStatus
                    value={form.status}
                    options={TABLE_STATUS}
                    onChange={(s) => setForm({ ...form, status: s })}
                  />
                </Field>
              </>
            )}

            {modal.entity === 'customer' && (
              <>
                <Field label="Nombre completo">
                  <input
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Telefono">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Cedula / documento">
                  <input
                    value={form.documentId}
                    onChange={(e) => setForm({ ...form, documentId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              </>
            )}

            {modal.entity === 'reservation' && (
              <>
                <Field label="Local">
                  <select
                    value={form.venueId}
                    onChange={(e) => setForm({ ...form, venueId: e.target.value, tableId: '' })}
                    disabled={!!modal.id}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  >
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cliente">
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sin cliente</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mesa">
                  <select
                    value={form.tableId}
                    onChange={(e) => setForm({ ...form, tableId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sin mesa</option>
                    {formVenueTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Mesa {t.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha y hora">
                  <input
                    type="datetime-local"
                    value={form.reservedAt}
                    onChange={(e) => setForm({ ...form, reservedAt: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Personas">
                  <input
                    type="number"
                    min="1"
                    value={form.partySize}
                    onChange={(e) => setForm({ ...form, partySize: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Notas">
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Estado">
                  <SelectStatus
                    value={form.status}
                    options={RESERVATION_STATUS}
                    onChange={(s) => setForm({ ...form, status: s })}
                  />
                </Field>
              </>
            )}

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
          <p className="text-sm text-gray-600">Esta accion elimina el elemento.</p>
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
    </main>
  );
}

function Row({
  title,
  subtitle,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="truncate text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onEdit} className="text-xs text-gray-500 hover:text-gray-900">
          Editar
        </button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
          Borrar
        </button>
      </div>
    </li>
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

function SelectStatus({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (s: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
