'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, clearToken, getToken, setToken } from './api';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const USER_KEY = 'aibos_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Rehidrata la sesion desde localStorage al montar.
  useEffect(() => {
    const token = getToken();
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(USER_KEY) : null;
    if (token && raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        clearToken();
      }
    }
    setReady(true);
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiFetch<LoginResponse>('/identity/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.accessToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout(): void {
    clearToken();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_KEY);
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
