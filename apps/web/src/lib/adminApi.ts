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

/**
 * Typed client for every /api/admin endpoint. All requests are
 * automatically guarded on the server by requireAuth + requireAdmin —
 * the frontend AdminRoute guard is a UX convenience (fast redirect),
 * not the real security boundary.
 */
export const adminApi = {
  // Dashboard
  getDashboardStats: () =>
    request<AdminDashboardStats>('/admin/dashboard'),

  // Templates
  listTemplates: () =>
    request<{ templates: AdminTemplateRow[] }>('/admin/templates'),
  updateTemplate: (id: string, body: UpdateTemplateListingRequest) =>
    request<{ listing: TemplateListing }>(`/admin/templates/${id}`, { method: 'PUT', body }),

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
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    if (params?.tier) qs.set('tier', params.tier);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<AdminUserListResponse>(`/admin/users${query}`);
  },
  grantPoints: (body: GrantPointsRequest) =>
    request<{ newBalance: number }>('/admin/users/grant-points', { method: 'POST', body }),
  updateUserRole: (body: UpdateUserRoleRequest) =>
    request<{ id: string; role: string }>('/admin/users/role', { method: 'POST', body }),

  // Audit log
  getAuditLog: (limit?: number) => {
    const query = limit ? `?limit=${limit}` : '';
    return request<{ entries: AdminAuditLogEntry[] }>(`/admin/audit-log${query}`);
  },
};
