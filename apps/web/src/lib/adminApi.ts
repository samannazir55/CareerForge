import { request } from './api.js';
import type {
  AdminDashboardStats,
  AdminTemplateRow,
  TemplateListing,
  UpdateTemplateListingRequest,
  SubscriptionPlan,
  UpsertSubscriptionPlanRequest,
  AdminUserListResponse,
  GrantPointsRequest,
  UpdateUserRoleRequest,
  AdminAuditLogEntry,
} from '@careerforge/schema';

export interface DynamicTemplate {
  id:           string;
  name:         string;
  slug:         string;
  category:     string;
  templateHtml: string;
  thumbnailUrl: string | null;
  pointsCost:   number;
  displayOrder: number;
  isActive:     boolean;
  promptUsed:   string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface GeneratedTemplate {
  name:     string;
  slug:     string;
  category: string;
  html:     string;
}

export const adminApi = {
  // Dashboard
  getDashboardStats: () =>
    request<AdminDashboardStats>('/admin/dashboard'),

  // Code-registered templates
  listTemplates: () =>
    request<{ templates: AdminTemplateRow[]; dynamicTemplates: DynamicTemplate[] }>('/admin/templates'),
  updateTemplate: (id: string, body: UpdateTemplateListingRequest) =>
    request<{ listing: TemplateListing }>(`/admin/templates/${id}`, { method: 'PUT', body }),

  // Dynamic templates
  generateTemplate: (prompt: string) =>
    request<GeneratedTemplate>('/admin/templates/generate', { method: 'POST', body: { prompt } }),
  createDynamicTemplate: (body: Omit<DynamicTemplate, 'id' | 'createdAt' | 'updatedAt'> & { promptUsed?: string }) =>
    request<{ template: DynamicTemplate }>('/admin/templates/dynamic', { method: 'POST', body }),
  updateDynamicTemplate: (id: string, body: Partial<DynamicTemplate>) =>
    request<{ template: DynamicTemplate }>(`/admin/templates/dynamic/${id}`, { method: 'PUT', body }),
  deleteDynamicTemplate: (id: string) =>
    request<{ success: boolean }>(`/admin/templates/dynamic/${id}`, { method: 'DELETE' }),

  // Subscription plans
  listPlans: () =>
    request<{ plans: SubscriptionPlan[] }>('/admin/plans'),
  createPlan: (body: UpsertSubscriptionPlanRequest) =>
    request<{ plan: SubscriptionPlan }>('/admin/plans', { method: 'POST', body }),
  updatePlan: (id: string, body: UpsertSubscriptionPlanRequest) =>
    request<{ plan: SubscriptionPlan }>(`/admin/plans/${id}`, { method: 'PUT', body }),
  deletePlan: (id: string) =>
    request<{ success: boolean }>(`/admin/plans/${id}`, { method: 'DELETE' }),

  // Users
  listUsers: (params?: {
    search?: string;
    role?: 'USER' | 'ADMIN';
    tier?: 'FREE' | 'PROFESSIONAL' | 'PREMIUM';
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search)   qs.set('search',   params.search);
    if (params?.role)     qs.set('role',     params.role);
    if (params?.tier)     qs.set('tier',     params.tier);
    if (params?.page)     qs.set('page',     String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<AdminUserListResponse>(`/admin/users${query}`);
  },
  grantPoints: (body: GrantPointsRequest) =>
    request<{ newBalance: number }>('/admin/users/grant-points', { method: 'POST', body }),
  updateUserRole: (body: UpdateUserRoleRequest) =>
    request<{ id: string; role: string }>('/admin/users/role', { method: 'POST', body }),

  // Points economy
  getTransactions: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request<{
      transactions: Array<{
        id: string; userId: string; userEmail: string; userFullName: string | null;
        type: string; amount: number; earnReason: string | null;
        spendReason: string | null; description: string | null; createdAt: string;
      }>;
    }>(`/admin/points/transactions${query}`);
  },

  // Audit log
  getAuditLog: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request<{ entries: AdminAuditLogEntry[] }>(`/admin/audit-log${query}`);
  },
};
