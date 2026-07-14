import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { LanguageProvider } from '@/lib/language-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Business OS',
  description: 'Plataforma SaaS multi-tenant para bares y discotecas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
