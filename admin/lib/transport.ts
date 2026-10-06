import { useAuthStore } from './auth-store';

// Keep browser session and CSRF cookies on the admin's origin. Next forwards these
// paths using API_BACKEND_URL; legacy public API URLs can point at a different site.
export const API_BASE = '/api/v1';
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
type Session = { token: string; data: { user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']> } };
let refreshPromise: Promise<Session> | null = null;

async function send(url: string, options: RequestInit, auth: boolean): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  const state = useAuthStore.getState();
  if (auth && state.accessToken) headers.set('Authorization', `Bearer ${state.accessToken}`);
  if (auth && state.twoFactorToken) headers.set('X-2FA-Token', state.twoFactorToken);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(options.method || 'GET')) {
    const csrf = await fetch(`${API_BASE}/auth/csrf-token`, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!csrf.ok) throw new ApiError('Unable to secure this request. Please retry.', csrf.status);
    const payload = await csrf.json();
    headers.set('X-CSRF-Token', payload.data.csrfToken);
  }
  return fetch(url, { ...options, headers, credentials: 'include', cache: 'no-store', signal: options.signal || AbortSignal.timeout(30_000) });
}

export async function request(url: string, options: RequestInit = {}, auth = true): Promise<Response> {
  try {
    let response = await send(url, options, auth);
    let body = response.ok ? null : await response.clone().json().catch(() => null);
    if (response.status === 403 && body?.code === 'CSRF_INVALID') {
      response = await send(url, options, auth);
      body = response.ok ? null : await response.clone().json().catch(() => null);
    }
    const twoFactor = /2fa|two.factor/i.test(body?.message || '');
    if (response.status === 401 && auth && !twoFactor) {
      await refreshSession();
      response = await send(url, options, auth);
      body = response.ok ? null : await response.clone().json().catch(() => null);
    }
    if (!response.ok) {
      if (response.status === 401 && !/2fa|two.factor/i.test(body?.message || '')) useAuthStore.getState().clearAuth();
      const fallback: Record<number, string> = { 401: 'Please sign in again.', 403: 'You do not have permission for this action.', 404: 'This record no longer exists.', 409: 'The record changed. Refresh and try again.', 422: 'Check the entered information.', 429: 'Too many requests. Wait before retrying.' };
      throw new ApiError(response.status >= 500 ? 'The service is unavailable. Please retry shortly.' : body?.message || fallback[response.status] || 'Request failed.', response.status, twoFactor ? '2FA_REQUIRED' : body?.code);
    }
    // DELETE handlers legitimately return 204; consumers may still call json().
    if (response.status === 204) return Response.json(null);
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Cannot reach the server. Check your connection and retry.', 0);
  }
}

export function refreshSession(): Promise<Session> {
  if (!refreshPromise) {
    const refresh = async () => {
      const response = await request(`${API_BASE}/auth/refresh`, { method: 'POST' }, false);
      const session: Session = await response.json();
      if (!session.token || !session.data?.user) throw new ApiError('Please sign in again.', 401);
      useAuthStore.getState().setToken(session.token);
      useAuthStore.getState().setUser(session.data.user);
      return session;
    };
    refreshPromise = (typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('customforge-refresh', refresh).then(session => session) : refresh())
      .catch(error => { useAuthStore.getState().clearAuth(); throw error; })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise!;
}
