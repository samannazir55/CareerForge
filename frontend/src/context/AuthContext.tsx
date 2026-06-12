import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
} 

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizeUser = (raw: Record<string, unknown>): User => ({
  id: raw.id as number,
  email: raw.email as string,
  full_name: (raw.full_name as string) || null,
  fullName: (raw.full_name as string) || null,
  is_active: raw.is_active as boolean,
  subscription_plan: (raw.subscription_plan as User['subscription_plan']) || 'basic',
  credits: (raw.credits as number) || 0,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('cf_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const raw = await authApi.getProfile();
      setUser(normalizeUser(raw));
    } catch {
      localStorage.removeItem('cf_token');
      setUser(null);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      await authApi.login(email, password);
      const raw = await authApi.getProfile();
      setUser(normalizeUser(raw));
      return { success: true };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Login failed. Please check your credentials.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    try {
      setError(null);
      await authApi.register(fullName, email, password);
      const raw = await authApi.getProfile();
      setUser(normalizeUser(raw));
      return { success: true };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Registration failed. This email may already be in use.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
