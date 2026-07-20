'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { localized, type Paginated } from '@/lib/types';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface Venue {
  id: string;
  name: string;
  taxRate: string;
  status: string;
}

interface Product {
  id: string;
  name: Record<string, string>;
  price: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, ready, logout } = useAuth();
  const { locale } = useLanguage();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Proteccion de ruta.
  useEffect(() => {
    if (ready && !user) {
      router.replace('/login');
    }
  }, [ready, user, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, v, p] = await Promise.all([
        apiFetch<Tenant>('/tenants/me'),
        apiFetch<Venue[]>('/venues'),
        apiFetch<Paginated<Product>>('/products?pageSize=100'),
      ]);
      setTenant(t);
      setVenues(v);
      setProducts(p.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && user) {
      void loadData();
    }
  }, [ready, user, loadData]);

  function onLogout() {
    logout();
    router.replace('/login');
  }

  if (!ready || !user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{tenant?.name ?? 'Dashboard'}</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              href="/dashboard/catalog"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Catalogo
            </Link>
            <Link
              href="/dashboard/operations"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Operacion
            </Link>
            <Link
              href="/dashboard/pos"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Punto de venta
            </Link>
            <button
              onClick={onLogout}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Locales ({venues.length})
              </h2>
              <ul className="space-y-2">
                {venues.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">{v.name}</span>
                    <span className="text-xs text-gray-500">IVA {v.taxRate}%</span>
                  </li>
                ))}
                {venues.length === 0 && <li className="text-sm text-gray-400">Sin locales.</li>}
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Carta ({products.length})
              </h2>
              <ul className="space-y-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {localized(p.name, locale)}
                    </span>
                    <span className="text-sm text-gray-700">${Number(p.price).toFixed(2)}</span>
                  </li>
                ))}
                {products.length === 0 && <li className="text-sm text-gray-400">Sin productos.</li>}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
