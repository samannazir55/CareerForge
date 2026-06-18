import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserPublic,
} from '@careerforge/schema';

/**
 * Access token lives in memory only — never localStorage/sessionStorage, so
 * it isn't readable by an XSS payload that can run arbitrary JS but can't
 * read memory across a page reload. It's re-minted on page load via
 * POST /api/auth/refresh, which relies on the httpOnly refresh cookie.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuthRetry?: boolean; // used internally to prevent infinite refresh loops
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include', // sends/receives the httpOnly refresh cookie
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !options.skipAuthRetry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, options);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

let refreshInFlight: Promise<boolean> | null = null;

/** De-duplicates concurrent refresh attempts (e.g. several components
 * mounting at once and all getting a 401) into a single network call. */
async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const data = await request<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRetry: true });
        setAccessToken(data.accessToken);
        return true;
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

// --- Auth API surface ---------------------------------------------------------

export const authApi = {
  register: (input: RegisterRequest) => request<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: UserPublic }>('/auth/me'),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRetry: true }),
  verifyOtp: (code: string) => request<{ user: UserPublic }>('/auth/otp/verify', { method: 'POST', body: { code } }),
  resendOtp: () => request<{ message: string }>('/auth/otp/resend', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (input: ResetPasswordRequest) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: input }),
  oauthStartUrl: (provider: 'google' | 'github') => `/api/auth/oauth/${provider}`,
};
