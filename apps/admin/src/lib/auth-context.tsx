'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ADMIN_KEY, apiFetch, clearToken, getToken, setToken } from './api';

export interface AdminUser {
  id: string;
  email: string;
}

interface LoginResponse {
  accessToken: string;
  admin: AdminUser;
}

interface AuthContextValue {
  admin: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  // Rehidrata la sesion de plataforma desde localStorage al montar.
  useEffect(() => {
    const token = getToken();
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_KEY) : null;
    if (token && raw) {
      try {
        setAdmin(JSON.parse(raw) as AdminUser);
      } catch {
        clearToken();
      }
    }
    setReady(true);
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch<LoginResponse>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.accessToken);
    window.localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
    setAdmin(data.admin);
  }

  function logout(): void {
    clearToken();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_KEY);
    }
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ admin, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
