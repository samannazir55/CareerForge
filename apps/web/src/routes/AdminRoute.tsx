import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard for the admin panel. Sits inside ProtectedRoute so
 * the authenticated + email-verified checks already passed before this
 * component renders. This guard only needs to check the role.
 *
 * Security note: the real enforcement is server-side via requireAdmin
 * middleware on every /api/admin route. This guard is a UX convenience
 * so non-admin users see a redirect rather than a 403 on every action.
 */
export function AdminRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
