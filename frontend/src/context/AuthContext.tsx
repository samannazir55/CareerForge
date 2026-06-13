import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import {
  login as apiLogin,
  register as apiRegister,
  verifyOTP as apiVerifyOTP,
  resendOTP as apiResendOTP,
  getProfile,
  logout as apiLogout,
} from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem('cf_token');
    if (!token) { setLoading(false); return; }
    try {
      const u = await getProfile();
      setUser({ ...u, fullName: u.full_name ?? undefined });
    } catch {
      localStorage.removeItem('cf_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const login = async (email: string, password: string) => {
    try {
      await apiLogin(email, password);
      const u = await getProfile();
      setUser({ ...u, fullName: u.full_name ?? undefined });
      return { success: true };
    } catch (err: any) {
      const detail = err.response?.data?.detail || '';
      if (detail === 'EMAIL_NOT_VERIFIED') {
        return { success: false, needsVerification: true, error: 'EMAIL_NOT_VERIFIED' };
      }
      return { success: false, error: detail || 'Invalid email or password.' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      await apiRegister(name, email, password);
      // Don't set user yet — pending verification
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.detail || 'Registration failed.' };
    }
  };

  const verifyOTP = async (email: string, otp: string) => {
    try {
      await apiVerifyOTP(email, otp);   // sets cf_token in localStorage
      const u = await getProfile();
      setUser({ ...u, fullName: u.full_name ?? undefined });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.detail || 'Invalid code.' };
    }
  };

  const resendOTP = async (email: string) => {
    try {
      await apiResendOTP(email);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.detail || 'Could not resend code.' };
    }
  };

  const logout = () => { apiLogout(); setUser(null); };
  const refreshUser = async () => { await loadUser(); };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyOTP, resendOTP, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
