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
  PublicTemplateListItem,
  JobApplication,
  CreateJobApplicationRequest,
  UpdateJobApplicationRequest,
  JobApplicationStatus,
  JobSearchResponse,
  JobSearchCountry,
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

/** Same idea as rawRequest, but for multipart/form-data (file uploads).
 * Deliberately does NOT set Content-Type -- the browser needs to set it
 * itself so it can include the multipart boundary string, which we have
 * no way to generate manually here. */
async function rawMultipartRequest(path: string, formData: FormData, method: 'POST' | 'PATCH' = 'POST'): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: formData,
  });
}

/** Same request/retry semantics as request<T>, but for multipart file
 * uploads (resume photo). */
export async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  let res = await rawMultipartRequest(path, formData);

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawMultipartRequest(path, formData);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
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

/**
 * Same request/retry semantics as request<T>, but for endpoints that return
 * raw text (e.g. resume preview HTML) instead of JSON. Extracted as a
 * sibling rather than folded into request<T> so JSON callers keep their
 * existing typed return without every call site needing a parse-mode flag.
 */
export async function requestText(path: string, options: RequestOptions = {}): Promise<string> {
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

  return res.text();
}

/**
 * Same request/retry semantics as request<T>, but for binary downloads
 * (PDF/DOCX export). Added so the export buttons can react to a 403
 * (premium-gated template) with an in-app message instead of being a plain
 * <a href> that dumps a raw JSON error into a blank new tab — which is what
 * happened before, silently, with nothing telling the user why nothing
 * downloaded.
 */
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<{ blob: Blob; filename: string | null }> {
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

  const disposition = res.headers.get('Content-Disposition');
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? null;
  return { blob: await res.blob(), filename };
}

let onSessionExpired: (() => void) | null = null;

/**
 * Registered once by AuthContext. Called whenever tryRefresh() definitively
 * fails — the refresh cookie itself is invalid/expired, not just the
 * in-memory access token. Without this, a mid-session token expiry (the
 * access token naturally expires; the automatic refresh-on-401 retry then
 * also fails) surfaced as a raw ApiError with a code like MISSING_TOKEN
 * bubbling up into whatever local component's error state happened to catch
 * it — e.g. the resume editor's export-error banner — reading like a
 * cryptic internal bug rather than "please sign in again."
 */
export function setOnSessionExpired(callback: (() => void) | null): void {
  onSessionExpired = callback;
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

// Every caller — the 401-retry logic below AND AuthContext's mount-time
// bootstrap — now goes through this single shared promise instead of each
// firing its own POST /auth/refresh. That used to be a real race: refresh
// tokens are rotated/revoked server-side on use (auth.service.ts), so two
// concurrent refresh calls sharing the same httpOnly cookie meant the
// second one always failed against an already-revoked token. On first
// page load, AuthContext's bootstrap refresh and every other component's
// 401-triggered refresh (dashboard stats, points, points/templates,
// preview-render, etc. all fetch on mount before the access token is
// hydrated) were exactly that pair of concurrent calls — hence the burst
// of unrelated 401s across totally different endpoints at once.
async function performRefresh(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const data = await request<AuthResponse>('/auth/refresh', { method: 'POST', skipAuthRetry: true });
        setAccessToken(data.accessToken);
        return data;
      } catch {
        setAccessToken(null);
        onSessionExpired?.();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function tryRefresh(): Promise<boolean> {
  return (await performRefresh()) !== null;
}

/** Exported so AuthContext's mount-time bootstrap can share the same
 * in-flight refresh as every other request's 401 retry, instead of firing
 * a second, independent /auth/refresh call. See performRefresh() above. */
export async function refreshSession(): Promise<AuthResponse | null> {
  return performRefresh();
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
  export: (id: string, format: 'pdf' | 'docx') => requestBlob(`/resumes/${id}/export/${format}`),
  uploadPhoto: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return requestMultipart<{ resume: Resume }>(`/resumes/${id}/photo`, formData);
  },
  deletePhoto: (id: string) => request<{ resume: Resume }>(`/resumes/${id}/photo`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: () => request<{
    user: { fullName: string | null; email: string; subscriptionTier: string; isEmailVerified: boolean };
    stats: { resumeCount: number; pointsBalance: number; atsScore: number | null; careerHealthScore: number | null };
    recentResumes: Array<{ id: string; title: string; templateId: string; updatedAt: string }>;
    subscription: { tier: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  }>('/dashboard'),
};

export interface PublicPlan {
  tierKey: string;
  name: string;
  priceMonthlyUsd: number;
  description: string | null;
  features: string[];
}

export const plansApi = {
  list: () => request<{ plans: PublicPlan[] }>('/plans'),
};

export const pointsApi = {
  get: () => request<{ balance: number; transactions: Array<{ id: string; type: string; amount: number; description: string | null; createdAt: string }> }>('/points'),
  getTemplates: () => request<{ templates: Array<{ id: string; name: string; category: string; family: string; cost: number; owned: boolean }> }>('/points/templates'),
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
    request<{ reply: string; resumeUpdate?: ChatResumeUpdate; suggestions?: string[]; degraded?: boolean }>('/ai/chat', { method: 'POST', body: { messages, resumeId } }),
  scoreATS: (resumeId: string, jobDescription?: string) =>
    request<{ score: number; missingKeywords: string[]; missingSections: string[]; suggestions: string[] }>('/ai/ats-score', { method: 'POST', body: { resumeId, jobDescription } }),
  matchJob: (resumeId: string, jobDescription: string) =>
    request<{ matchScore: number; matchedKeywords: string[]; missingKeywords: string[]; suggestions: string[] }>('/ai/job-match', { method: 'POST', body: { resumeId, jobDescription } }),
  generateCoverLetter: (resumeId: string, jobDescription: string, tone?: string) =>
    request<{ coverLetter: string }>('/ai/cover-letter', { method: 'POST', body: { resumeId, jobDescription, tone } }),
  importResume: (rawText: string) =>
    request<{ extracted: ChatResumeUpdate }>('/ai/import', { method: 'POST', body: { rawText } }),
  tailorResume: (resumeId: string, jobDescription: string) =>
    request<{ resumeId: string; matchScore: number; suggestions: string[] }>('/ai/tailor-resume', {
      method: 'POST',
      body: { resumeId, jobDescription },
    }),
};

export interface InterviewQuestion {
  id: string;
  question: string;
  category: 'behavioural' | 'technical' | 'situational' | 'culture';
  difficulty: 'easy' | 'medium' | 'hard';
  tip: string;
}

export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  improvements: string[];
  idealAnswer: string;
}

export const interviewApi = {
  generateQuestions: (resumeId: string, jobDescription: string, count?: number) =>
    request<{ questions: InterviewQuestion[] }>('/interview/questions', {
      method: 'POST',
      body: { resumeId, jobDescription, count },
    }),
  evaluateAnswer: (question: string, answer: string, jobDescription: string) =>
    request<{ evaluation: AnswerEvaluation }>('/interview/evaluate', {
      method: 'POST',
      body: { question, answer, jobDescription },
    }),
  saveSession: (body: { resumeId: string; jobDescription: string; questions: InterviewQuestion[]; answers: Record<string, string> }) =>
    request<{ sessionId: string; overallScore: number; summary: string }>('/interview/session', {
      method: 'POST',
      body,
    }),
};

export interface LinkedInOptimization {
  headline: string;
  summary: string;
  experienceBlurbs: Array<{
    title: string;
    company: string;
    bullets: string[];
  }>;
  skills: string[];
  recommendations: Array<{
    section: string;
    issue: string;
    fix: string;
  }>;
}

export const linkedinApi = {
  optimize: (resumeId: string, targetRole?: string) =>
    request<{ optimization: LinkedInOptimization }>('/linkedin/optimize', {
      method: 'POST',
      body: { resumeId, targetRole },
    }),
};

export const templatesApi = {
  list: () => request<{ templates: PublicTemplateListItem[] }>('/templates'),
  preview: (id: string) => requestText(`/templates/${id}/preview`),
};

export const sharingApi = {
  enable: (resumeId: string) => request<{ slug: string; isEnabled: boolean }>(`/resumes/${resumeId}/share`, { method: 'POST' }),
  disable: (resumeId: string) => request<void>(`/resumes/${resumeId}/share`, { method: 'DELETE' }),
  publicUrl: (slug: string) => `/api/public/${slug}`,
};

export const jobsApi = {
  list: (status?: JobApplicationStatus) => request<{ jobs: JobApplication[] }>(status ? `/jobs?status=${status}` : '/jobs'),
  create: (input: CreateJobApplicationRequest) => request<{ job: JobApplication }>('/jobs', { method: 'POST', body: input }),
  update: (id: string, input: UpdateJobApplicationRequest) => request<{ job: JobApplication }>(`/jobs/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<void>(`/jobs/${id}`, { method: 'DELETE' }),
};

export const jobSearchApi = {
  search: (params: { q: string; location?: string; country?: JobSearchCountry; page?: number }) => {
    const qs = new URLSearchParams({
      q: params.q,
      ...(params.location ? { location: params.location } : {}),
      ...(params.country ? { country: params.country } : {}),
      page: String(params.page ?? 1),
    });
    return request<JobSearchResponse>(`/job-search?${qs}`);
  },
};
