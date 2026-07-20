'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Modal } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import {
  localized,
  type Category,
  type Localized,
  type Paginated,
  type Product,
  type Venue,
} from '@/lib/types';

type Tab = 'products' | 'categories';
type Entity = 'product' | 'category';

interface FormState {
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  price: string;
  categoryId: string;
  venueId: string;
}

const EMPTY_FORM: FormState = {
  nameEs: '',
  nameEn: '',
  descEs: '',
  descEn: '',
  price: '',
  categoryId: '',
  venueId: '',
};

function buildLocalized(es: string, en: string): Localized {
  const obj: Localized = {};
  if (es.trim()) obj.es = es.trim();
  if (en.trim()) obj.en = en.trim();
  return obj;
}

export default function CatalogPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { locale } = useLanguage();

  const [tab, setTab] = useState<Tab>('products');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
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
      const [c, p, v] = await Promise.all([
        apiFetch<Category[]>('/categories'),
        apiFetch<Paginated<Product>>('/products?pageSize=100'),
        apiFetch<Venue[]>('/venues'),
      ]);
      setCategories(c);
      setProducts(p.data);
      setVenues(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando el catalogo');
    }
  }, []);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  function openCreate(entity: Entity) {
    setForm(EMPTY_FORM);
    setModal({ entity, id: null });
  }

  function openEdit(entity: Entity, item: Category | Product) {
    const isProduct = entity === 'product';
    const p = item as Product;
    setForm({
      nameEs: item.name.es ?? '',
      nameEn: item.name.en ?? '',
      descEs: isProduct ? (p.description?.es ?? '') : '',
      descEn: isProduct ? (p.description?.en ?? '') : '',
      price: isProduct ? String(Number(p.price)) : '',
      categoryId: isProduct ? (p.categoryId ?? '') : '',
      venueId: item.venueId ?? '',
    });
    setModal({ entity, id: item.id });
  }

  async function save() {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const name = buildLocalized(form.nameEs, form.nameEn);
      const base = modal.entity === 'product' ? '/products' : '/categories';
      const path = modal.id ? `${base}/${modal.id}` : base;
      const method = modal.id ? 'PATCH' : 'POST';

      let body: Record<string, unknown> = { name };
      if (modal.entity === 'product') {
        const description = buildLocalized(form.descEs, form.descEn);
        body = {
          name,
          ...(Object.keys(description).length > 0 ? { description } : {}),
          price: Number(form.price),
          ...(form.categoryId ? { categoryId: form.categoryId } : {}),
          ...(form.venueId ? { venueId: form.venueId } : {}),
        };
      }

      await apiFetch(path, { method, body: JSON.stringify(body) });
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
    const { entity, id } = confirm;
    setError(null);
    try {
      await apiFetch(`${entity === 'product' ? '/products' : '/categories'}/${id}`, {
        method: 'DELETE',
      });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
      setConfirm(null);
    }
  }

  if (!ready || !user) return null;

  const categoryName = (id: string | null) =>
    id ? localized(categories.find((c) => c.id === id)?.name ?? {}, locale) || '—' : '—';
  const venueName = (id: string | null) =>
    id ? (venues.find((v) => v.id === id)?.name ?? '—') : 'Todos los locales';

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Catalogo</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              onClick={() => openCreate(tab === 'products' ? 'product' : 'category')}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              + {tab === 'products' ? 'Producto' : 'Categoria'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-4 flex gap-2">
          {(['products', 'categories'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
              }`}
            >
              {t === 'products' ? 'Productos' : 'Categorias'}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {tab === 'products' ? (
          <ul className="space-y-2">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{localized(p.name, locale)}</p>
                  <p className="text-xs text-gray-500">
                    {categoryName(p.categoryId)} · {venueName(p.venueId)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-700">${Number(p.price).toFixed(2)}</span>
                  <button
                    onClick={() => openEdit('product', p)}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirm({ entity: 'product', id: p.id })}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
            {products.length === 0 && <li className="text-sm text-gray-400">Sin productos.</li>}
          </ul>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
              >
                <p className="text-sm font-medium text-gray-900">{localized(c.name, locale)}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEdit('category', c)}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirm({ entity: 'category', id: c.id })}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            ))}
            {categories.length === 0 && <li className="text-sm text-gray-400">Sin categorias.</li>}
          </ul>
        )}
      </div>

      {modal && (
        <Modal
          title={`${modal.id ? 'Editar' : 'Nuevo'} ${modal.entity === 'product' ? 'producto' : 'categoria'}`}
          onClose={() => setModal(null)}
        >
          <div className="space-y-3">
            <Field label="Nombre (Espanol)">
              <input
                value={form.nameEs}
                onChange={(e) => setForm({ ...form, nameEs: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Nombre (English)">
              <input
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>

            {modal.entity === 'product' && (
              <>
                <Field label="Descripcion (Espanol)">
                  <input
                    value={form.descEs}
                    onChange={(e) => setForm({ ...form, descEs: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
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
                <Field label="Categoria">
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sin categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {localized(c.name, locale)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Local">
                  <select
                    value={form.venueId}
                    onChange={(e) => setForm({ ...form, venueId: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Todos los locales</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
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
          <p className="text-sm text-gray-600">
            Esta accion elimina el elemento. Se puede recuperar solo desde la base de datos.
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
    </main>
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
