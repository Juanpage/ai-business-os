'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { localized, type Order, type Product, type Promotion, type Venue } from '@/lib/types';

type PaymentMethod = 'cash' | 'card' | 'transfer';

export default function PosPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [venueId, setVenueId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  // Carga inicial de venues, productos y promociones activas.
  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      try {
        const [v, p, promo] = await Promise.all([
          apiFetch<Venue[]>('/venues'),
          apiFetch<Product[]>('/products'),
          apiFetch<Promotion[]>('/promotions?status=active'),
        ]);
        setVenues(v);
        setProducts(p);
        setPromotions(promo);
        if (v.length > 0) setVenueId(v[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando datos');
      }
    })();
  }, [ready, user]);

  // Productos aplicables al venue: tenant-wide (venueId null) o del venue.
  const venueProducts = useMemo(
    () => products.filter((p) => p.venueId === null || p.venueId === venueId),
    [products, venueId],
  );

  const hasItems = (order?.items.length ?? 0) > 0;
  const isPaid = order?.status === 'paid';

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function ensureOrder(): Promise<Order | null> {
    if (order && order.status !== 'paid') return order;
    const created = await apiFetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ venueId }),
    });
    setOrder(created);
    return created;
  }

  async function addProduct(product: Product) {
    await run(async () => {
      const current = await ensureOrder();
      if (!current) return;
      const existing = current.items.find((i) => i.productId === product.id);
      const updated = existing
        ? await apiFetch<Order>(`/orders/${current.id}/items/${existing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: existing.quantity + 1 }),
          })
        : await apiFetch<Order>(`/orders/${current.id}/items`, {
            method: 'POST',
            body: JSON.stringify({ productId: product.id, quantity: 1 }),
          });
      setOrder(updated);
    });
  }

  async function changeQty(itemId: string, quantity: number) {
    if (!order) return;
    await run(async () => {
      const updated =
        quantity <= 0
          ? await apiFetch<Order>(`/orders/${order.id}/items/${itemId}`, { method: 'DELETE' })
          : await apiFetch<Order>(`/orders/${order.id}/items/${itemId}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity }),
            });
      setOrder(updated);
    });
  }

  async function applyPromo(promotionId: string) {
    if (!order) return;
    await run(async () => {
      const updated = promotionId
        ? await apiFetch<Order>(`/orders/${order.id}/promotion`, {
            method: 'POST',
            body: JSON.stringify({ promotionId }),
          })
        : await apiFetch<Order>(`/orders/${order.id}/promotion`, { method: 'DELETE' });
      setOrder(updated);
    });
  }

  async function charge() {
    if (!order) return;
    await run(async () => {
      const updated = await apiFetch<Order>(`/orders/${order.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ method, amount: Number(order.total) }),
      });
      setOrder(updated);
    });
  }

  const resetOrder = useCallback(() => {
    setOrder(null);
    setError(null);
  }, []);

  if (!ready || !user) return null;

  const money = (v: string | number) => `$${Number(v).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Punto de venta</h1>
          </div>
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            disabled={hasItems && !isPaid}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (IVA {v.taxRate}%)
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-[1fr_360px]">
        {/* Carta */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Carta
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {venueProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                disabled={busy || isPaid}
                className="flex flex-col items-start rounded-lg bg-white p-4 text-left shadow-sm ring-1 ring-gray-100 hover:ring-gray-300 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-gray-900">{localized(p.name)}</span>
                <span className="mt-1 text-sm text-gray-500">{money(p.price)}</span>
              </button>
            ))}
            {venueProducts.length === 0 && (
              <p className="text-sm text-gray-400">Sin productos para este local.</p>
            )}
          </div>
        </section>

        {/* Ticket / orden */}
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Orden</h2>
            {order && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {order.status}
              </span>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {!order || order.items.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">
              Toca un producto de la carta para iniciar la orden.
            </p>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-gray-100">
                {order.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {localized(it.productName)}
                      </p>
                      <p className="text-xs text-gray-500">{money(it.unitPrice)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isPaid && (
                        <button
                          onClick={() => changeQty(it.id, it.quantity - 1)}
                          disabled={busy}
                          className="h-6 w-6 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                        >
                          −
                        </button>
                      )}
                      <span className="w-5 text-center text-sm">{it.quantity}</span>
                      {!isPaid && (
                        <button
                          onClick={() => changeQty(it.id, it.quantity + 1)}
                          disabled={busy}
                          className="h-6 w-6 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                        >
                          +
                        </button>
                      )}
                      <span className="w-16 text-right text-sm text-gray-900">
                        {money(it.lineTotal)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Promocion */}
              {!isPaid && (
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500">Promocion</label>
                  <select
                    value={order.promotionId ?? ''}
                    onChange={(e) => applyPromo(e.target.value)}
                    disabled={busy}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Sin promocion</option>
                    {promotions.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {localized(pr.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Totales */}
              <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm">
                <Row label="Subtotal" value={money(order.subtotal)} />
                {Number(order.discountTotal) > 0 && (
                  <Row label="Descuento" value={`- ${money(order.discountTotal)}`} muted />
                )}
                <Row label="IVA" value={money(order.taxTotal)} />
                <div className="flex justify-between pt-1 text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{money(order.total)}</span>
                </div>
              </div>

              {/* Cobro */}
              {!isPaid ? (
                <div className="mt-5 space-y-3">
                  <div className="flex gap-2">
                    {(['cash', 'card', 'transfer'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                          method === m
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-300 text-gray-700'
                        }`}
                      >
                        {m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : 'Transfer.'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={charge}
                    disabled={busy}
                    className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    Cobrar {money(order.total)}
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
                    Orden pagada — {money(order.total)}
                  </p>
                  <button
                    onClick={resetOrder}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Nueva orden
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-gray-500' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
