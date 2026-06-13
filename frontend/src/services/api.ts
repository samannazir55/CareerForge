import axios from 'axios';
import { CVData, CVRecord, Template, User } from '../types';

const getBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  if (res.data.access_token) localStorage.setItem('cf_token', res.data.access_token);
  return res.data;
};

export const register = async (full_name: string, email: string, password: string) => {
  const res = await api.post('/auth/register', { full_name, email, password });
  // Returns {status: "pending_verification", email, message} — NO token yet
  return res.data;
};

export const verifyOTP = async (email: string, otp: string) => {
  const res = await api.post('/auth/verify-otp', { email, otp });
  if (res.data.access_token) localStorage.setItem('cf_token', res.data.access_token);
  return res.data;
};

export const resendOTP = async (email: string) => {
  const res = await api.post('/auth/resend-otp', { email });
  return res.data;
};

export const unlockTemplate = async (templateId: string) => {
  const res = await api.post(`/templates/${templateId}/unlock`);
  return res.data;
};

export const getUnlockedTemplates = async (): Promise<string[]> => {
  const res = await api.get('/templates/unlocked');
  return res.data.unlocked || [];
};

export const getProfile = async (): Promise<User> => {
  const res = await api.get('/auth/profile');
  return res.data;
};

export const logout = () => {
  localStorage.removeItem('cf_token');
};

// ─── Templates ───────────────────────────────────────────────────────────────
export const getTemplates = async (): Promise<Template[]> => {
  const res = await api.get('/templates');
  return res.data;
};

export const getTemplate = async (id: string): Promise<Template> => {
  const res = await api.get(`/templates/${id}`);
  return res.data;
};

// ─── CVs ─────────────────────────────────────────────────────────────────────
export const createCV = async (payload: { title: string; template_id: string; data: Partial<CVData> }): Promise<CVRecord> => {
  const res = await api.post('/cvs', payload);
  return res.data;
};

export const updateCV = async (id: number, payload: { title?: string; template_id?: string; data?: Partial<CVData> }): Promise<CVRecord> => {
  const res = await api.put(`/cvs/${id}`, payload);
  return res.data;
};

export const getCV = async (id: number): Promise<CVRecord> => {
  const res = await api.get(`/cvs/${id}`);
  return res.data;
};

export const getCVs = async (): Promise<CVRecord[]> => {
  const res = await api.get('/cvs');
  return res.data;
};

export const deleteCV = async (id: number): Promise<void> => {
  await api.delete(`/cvs/${id}`);
};

// ─── Export ───────────────────────────────────────────────────────────────────
export const exportCV = async (id: number, type: 'pdf' | 'docx'): Promise<Blob> => {
  const res = await api.get(`/cvs/${id}/export/${type}`, { responseType: 'blob' });
  return res.data;
};

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export const sendChatMessage = async (
  history: { role: string; content: string }[],
  message: string
) => {
  const res = await api.post('/ai/chat', { history, message });
  return res.data;
};

export const uploadResumeFile = async (file: File): Promise<{ extracted_text: string }> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/ai/upload-resume', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

// ─── Live Preview (no auth required) ──────────────────────────────────────────
export const getLivePreviewHtml = async (data: Partial<CVData>, templateId: string): Promise<string> => {
  const res = await api.post('/generate-pdf', { data, template_id: templateId });
  return res.data;
};

export default api;
