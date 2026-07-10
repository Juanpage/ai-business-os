import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Business OS',
  description: 'Plataforma SaaS multi-tenant para bares y discotecas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
