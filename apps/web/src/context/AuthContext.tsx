import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { LoginRequest, RegisterRequest, UserPublic } from '@careerforge/schema';
import { authApi, refreshSession, setAccessToken, setOnSessionExpired, ApiError } from '../lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserPublic | null;
  status: AuthStatus;
  // True only when a previously-valid session actually expired mid-use
  // (the access token expired and the refresh cookie was no longer valid
  // either) — as opposed to a plain "never logged in" visit. LoginPage uses
  // this to show "your session ended, please sign in again" instead of a
  // plain login form, and ProtectedRoute clears it once shown.
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  register: (input: RegisterRequest) => Promise<void>;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null as unknown as AuthContextValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);
  // Tracks whether this tab has ever reached 'authenticated', purely so the
  // session-expired callback (registered once, below) can tell a genuine
  // mid-session expiry apart from the ordinary "never logged in" path the
  // very first mount-time refresh attempt takes for a new visitor.
  const wasAuthenticated = useRef(false);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  // On first load there's no access token in memory (page was just (re)loaded),
  // so the only way to know if there's a valid session is to ask the API to
  // mint a fresh access token from the httpOnly refresh cookie.
  //
  // This goes through the shared refreshSession() helper (in lib/api.ts)
  // rather than calling authApi.refresh() directly. Refresh tokens are
  // rotated/revoked server-side on every use, so if some other component
  // mounted alongside AuthProvider also fetches on load (dashboard stats,
  // points, points/templates, preview-render, etc.), its request goes out
  // before this effect has hydrated the access token, gets a 401, and
  // fires its own refresh — a second call racing this one on the same
  // httpOnly cookie. Whichever refresh reached the server second was
  // handed an already-revoked token and failed, surfacing as a 401 on an
  // otherwise-unrelated endpoint. Routing everyone through the same
  // in-flight promise means only one /auth/refresh call ever goes out.
  useEffect(() => {
    (async () => {
      const data = await refreshSession();
      if (data) {
        setUser(data.user);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    })();
  }, []);

  useEffect(() => {
    if (status === 'authenticated') wasAuthenticated.current = true;
  }, [status]);

  // Registered exactly once for the lifetime of the app. Any authenticated
  // request anywhere — a chat message, an export, a resume save — can
  // trigger this the moment its 401-triggered refresh attempt definitively
  // fails, not just requests made directly through this context.
  useEffect(() => {
    setOnSessionExpired(() => {
      if (wasAuthenticated.current) setSessionExpired(true);
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setOnSessionExpired(null);
  }, []);

  const register = useCallback(async (input: RegisterRequest) => {
    const data = await authApi.register(input);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(async (input: LoginRequest) => {
    const data = await authApi.login(input);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined); // best-effort: clear local state even if the network call fails
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
    setSessionExpired(false);
  }, []);

  const verifyOtp = useCallback(async (code: string) => {
    const data = await authApi.verifyOtp(code);
    setUser(data.user);
  }, []);

  const resendOtp = useCallback(async () => {
    await authApi.resendOtp();
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    await authApi.resetPassword({ email, code, newPassword });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, sessionExpired, clearSessionExpired, register, login, logout, verifyOtp, resendOtp, forgotPassword, resetPassword, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}