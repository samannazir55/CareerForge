import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserPublic,
  Resume,
  ResumeSummary,
  ResumeVersion,
  ResumeVersionSummary,
  ResumeVersionDiff,
  CreateResumeRequest,
  UpdateResumeRequest,
  Section,
} from '@careerforge/schema';

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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuthRetry?: boolean;
}

async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !options.skipAuthRetry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawRequest(path, options);
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

export const authApi = {
  register: (input: RegisterRequest) => request<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginRequest) => request<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: UserPublic }>('/auth/me'),
  refresh: () => request<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRetry: true }),
  verifyOtp: (code: string) => request<{ user: UserPublic }>('/auth/otp/verify', { method: 'POST', body: { code } }),
  resendOtp: () => request<{ message: string }>('/auth/otp/resend', { method: 'POST' }),
  forgotPassword: (email: string) => request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (input: ResetPasswordRequest) => request<{ message: string }>('/auth/reset-password', { method: 'POST', body: input }),
  oauthStartUrl: (provider: 'google' | 'github') => `/api/auth/oauth/${provider}`,
};

export const resumeApi = {
  list: () => request<{ resumes: ResumeSummary[] }>('/resumes'),
  create: (input: CreateResumeRequest) => request<{ resume: Resume }>('/resumes', { method: 'POST', body: input }),
  get: (id: string) => request<{ resume: Resume }>(`/resumes/${id}`),
  update: (id: string, input: UpdateResumeRequest) => request<{ resume: Resume }>(`/resumes/${id}`, { method: 'PATCH', body: input }),
  delete: (id: string) => request<void>(`/resumes/${id}`, { method: 'DELETE' }),
  remove: (id: string) => request<void>(`/resumes/${id}`, { method: 'DELETE' }),
  listVersions: (id: string) => request<{ versions: ResumeVersionSummary[] }>(`/resumes/${id}/versions`),
  createVersion: (id: string, label?: string) => request<{ version: ResumeVersion }>(`/resumes/${id}/versions`, { method: 'POST', body: { label } }),
  getVersion: (id: string, versionId: string) => request<{ version: ResumeVersion }>(`/resumes/${id}/versions/${versionId}`),
  restoreVersion: (id: string, versionId: string) => request<{ resume: Resume }>(`/resumes/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  diffVersions: (id: string, fromId: string, toId: string) => request<{ diff: ResumeVersionDiff }>(`/resumes/${id}/versions/diff?from=${fromId}&to=${toId}`),
  compareVersions: (id: string, fromId: string, toId: string) => request<{ diff: ResumeVersionDiff }>(`/resumes/${id}/versions/diff?from=${fromId}&to=${toId}`),
};

export const dashboardApi = {
  get: () => request<{
    user: { fullName: string | null; email: string; subscriptionTier: string; isEmailVerified: boolean };
    stats: { resumeCount: number; pointsBalance: number; atsScore: number | null; careerHealthScore: number | null };
    recentResumes: Array<{ id: string; title: string; templateId: string; updatedAt: string }>;
    subscription: { tier: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  }>('/dashboard'),
};

export const pointsApi = {
  get: () => request<{ balance: number; transactions: Array<{ id: string; type: string; amount: number; description: string | null; createdAt: string }> }>('/points'),
  getTemplates: () => request<{ templates: Array<{ id: string; name: string; category: string; cost: number }> }>('/points/templates'),
  purchaseTemplate: (templateId: string) => request<{ message: string }>('/points/purchase-template', { method: 'POST', body: { templateId } }),
};

export const paymentsApi = {
  getStatus: () => request<{ tier: string; subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null }>('/payments/status'),
  createCheckout: (tier: 'PROFESSIONAL' | 'PREMIUM') => request<{ url: string }>('/payments/checkout', { method: 'POST', body: { tier } }),
  createPortal: () => request<{ url: string }>('/payments/portal', { method: 'POST' }),
};

interface ChatResumeUpdate {
  title?: string;
  sections?: Section[];
}

export const aiApi = {
  chat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>, resumeId?: string) =>
    request<{ reply: string; resumeUpdate?: ChatResumeUpdate }>('/ai/chat', { method: 'POST', body: { messages, resumeId } }),
  scoreATS: (resumeId: string, jobDescription?: string) =>
    request<{ score: number; missingKeywords: string[]; missingSections: string[]; suggestions: string[] }>('/ai/ats-score', { method: 'POST', body: { resumeId, jobDescription } }),
  matchJob: (resumeId: string, jobDescription: string) =>
    request<{ matchScore: number; matchedKeywords: string[]; missingKeywords: string[]; suggestions: string[] }>('/ai/job-match', { method: 'POST', body: { resumeId, jobDescription } }),
  generateCoverLetter: (resumeId: string, jobDescription: string, tone?: string) =>
    request<{ coverLetter: string }>('/ai/cover-letter', { method: 'POST', body: { resumeId, jobDescription, tone } }),
  importResume: (rawText: string) =>
    request<{ extracted: ChatResumeUpdate }>('/ai/import', { method: 'POST', body: { rawText } }),
};

export const sharingApi = {
  enable: (resumeId: string) => request<{ slug: string; isEnabled: boolean }>(`/resumes/${resumeId}/share`, { method: 'POST' }),
  disable: (resumeId: string) => request<void>(`/resumes/${resumeId}/share`, { method: 'DELETE' }),
  publicUrl: (slug: string) => `/api/public/${slug}`,
};