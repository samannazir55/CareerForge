import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * The backend has already exchanged the OAuth code and set the refresh
 * cookie before redirecting the browser here (see auth.routes.ts). This page
 * doesn't receive or handle any token itself — AuthProvider's mount effect
 * calls /auth/refresh using that cookie and populates `status`/`user`. This
 * page just waits for that to resolve and routes accordingly.
 */
export function OAuthCallbackPage() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
    if (status === 'unauthenticated') navigate('/login?error=oauth_failed', { replace: true });
  }, [status, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-ai flex items-center justify-center">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
