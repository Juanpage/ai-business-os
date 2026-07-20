'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/tenants', label: 'Tenants' },
  { href: '/plans', label: 'Planes' },
];

/** Shell del back-office: header oscuro (distingue plataforma de tenant),
 *  navegacion y proteccion de ruta. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, ready, logout } = useAuth();

  useEffect(() => {
    if (ready && !admin) router.replace('/login');
  }, [ready, admin, router]);

  if (!ready || !admin) return null;

  function onLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-sm font-semibold text-white">AI Business OS · Plataforma</h1>
              <p className="text-xs text-gray-400">{admin.email}</p>
            </div>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    pathname === item.href
                      ? 'bg-white/15 text-white'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={onLogout}
            className="rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10"
          >
            Cerrar sesion
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
