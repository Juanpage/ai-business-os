// Cliente HTTP minimo hacia la API (fetch nativo, sin dependencias).

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const TOKEN_KEY = 'aibos_token';

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

  // Sesion invalida o expirada (el JWT dura 1 dia): limpia y manda al login.
  // Solo si la peticion iba autenticada; un 401 sin token es un login fallido.
  if (res.status === 401 && token) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('aibos_user');
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
