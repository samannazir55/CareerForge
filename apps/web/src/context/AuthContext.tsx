import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { LoginRequest, RegisterRequest, UserPublic } from '@careerforge/schema';
import { authApi, setAccessToken, ApiError } from '../lib/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserPublic | null;
  status: AuthStatus;
  register: (input: RegisterRequest) => Promise<void>;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // On first load there's no access token in memory (page was just (re)loaded),
  // so the only way to know if there's a valid session is to ask the API to
  // mint a fresh access token from the httpOnly refresh cookie.
  useEffect(() => {
    (async () => {
      try {
        const data = await authApi.refresh();
        setAccessToken(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      } catch {
        setAccessToken(null);
        setUser(null);
        setStatus('unauthenticated');
      }
    })();
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
      value={{ user, status, register, login, logout, verifyOtp, resendOtp, forgotPassword, resetPassword, refreshUser }}
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
