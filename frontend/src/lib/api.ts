import type { AuthResponse, User } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';
const TOKEN_KEY = 'hackauth_token';
const USER_KEY = 'user_session';

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText;
    if (res.status === 401) {
      clearSession();
    }
    throw new ApiError(res.status, detail, data);
  }
  return data as T;
}

function safejson_(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
function safeJson(s: string) {
  return safejson_(s);
}

async function requestForm<T>(path: string, formData: FormData, auth = true): Promise<T> {
  const headers = new Headers();
  if (auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { method: 'POST', body: formData, headers });
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText;
    if (res.status === 401) clearSession();
    throw new ApiError(res.status, detail, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: 'GET' }, { auth }),
  upload: <T>(path: string, formData: FormData, auth = true) => requestForm<T>(path, formData, auth),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, { auth }),
  put: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }, { auth }),
  patch: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }, { auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: 'DELETE' }, { auth }),
};

export { ApiError };
export type { AuthResponse };
