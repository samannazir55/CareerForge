import axios from 'axios';
import type { Token, CVRecord, BackendTemplate, AIResponse } from '../types';

// Dynamic base URL: local → port 8000, production → relative /api
const getBaseUrl = () => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8000/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler → redirect to login
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

// ------ Auth ------

export const authApi = {
  login: async (email: string, password: string): Promise<Token> => {
    const res = await api.post<Token>('/auth/login', { email, password });
    localStorage.setItem('cf_token', res.data.access_token);
    return res.data;
  },

  register: async (fullName: string, email: string, password: string): Promise<Token> => {
    const res = await api.post<Token>('/auth/register', {
      full_name: fullName,
      email,
      password,
    });
    localStorage.setItem('cf_token', res.data.access_token);
    return res.data;
  },

  getProfile: async () => {
    const res = await api.get('/auth/profile');
    return res.data;
  },

  logout: () => {
    localStorage.removeItem('cf_token');
    window.location.href = '/login';
  },
};

// ------ CVs ------

export const cvApi = {
  list: async (): Promise<CVRecord[]> => {
    const res = await api.get<CVRecord[]>('/cvs');
    return res.data;
  },

  get: async (id: number): Promise<CVRecord> => {
    const res = await api.get<CVRecord>(`/cvs/${id}`);
    return res.data;
  },

  create: async (payload: object): Promise<CVRecord> => {
    const res = await api.post<CVRecord>('/cvs', payload);
    return res.data;
  },

  update: async (id: number, payload: object): Promise<CVRecord> => {
    const res = await api.put<CVRecord>(`/cvs/${id}`, payload);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/cvs/${id}`);
  },

  export: async (id: number, format: 'pdf' | 'docx' | 'html'): Promise<Blob> => {
    const res = await api.get(`/cvs/${id}/export/${format}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

// ------ Templates ------

export const templateApi = {
  list: async (): Promise<BackendTemplate[]> => {
    const res = await api.get<BackendTemplate[]>('/templates');
    return res.data;
  },

  get: async (id: string): Promise<BackendTemplate> => {
    const res = await api.get<BackendTemplate>(`/templates/${id}`);
    return res.data;
  },

  generatePreview: async (templateId: string, data: object): Promise<string> => {
    const res = await api.post(
      '/generate-pdf',
      { template_id: templateId, data },
      { responseType: 'text' }
    );
    return res.data as string;
  },
};

// ------ AI ------

export const aiApi = {
  chat: async (
    history: Array<{ role: string; content: string }>,
    message: string
  ): Promise<AIResponse> => {
    const res = await api.post<AIResponse>('/ai/chat', { history, message });
    return res.data;
  },

  uploadResume: async (file: File): Promise<{ extracted_text: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/ai/upload-resume', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export default api;
