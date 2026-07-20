// Cliente HTTP hacia la API de plataforma (fetch nativo, sin dependencias).
// OJO: claves de localStorage PROPIAS del admin (aibos_admin_*) para no
// colisionar con la sesion de tenant de apps/web (mismo origen localhost).

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const TOKEN_KEY = 'aibos_admin_token';
export const ADMIN_KEY = 'aibos_admin';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Sesion de plataforma invalida o expirada: limpia y manda al login.
  if (res.status === 401 && token) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_KEY);
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Sesion expirada');
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
