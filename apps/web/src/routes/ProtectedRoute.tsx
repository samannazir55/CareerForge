import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Single place that enforces "verification required before access" — any
 * future route added under this guard automatically gets the same rule
 * rather than each page re-checking req.user.isEmailVerified itself.
 */
export function ProtectedRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.isEmailVerified) {
    return <Navigate to="/verify-otp" replace />;
  }

  return <Outlet />;
}
