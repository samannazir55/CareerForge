import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';

/**
 * Placeholder for the real Dashboard (resume count, ATS score, Career Health
 * Score, points balance, recent resumes, etc. — Resume Core + surrounding-UX
 * phases). This exists now so the auth flow has somewhere real to land and
 * is reviewable end-to-end, without pretending the full dashboard is built.
 */
export function HomePlaceholderPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <GlassCard className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-2">You're in, {user?.fullName ?? 'there'}.</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Auth is fully wired (email verified: {String(user?.isEmailVerified)}). The real dashboard — resume count,
          ATS score, Career Health Score, points balance — lands in the next implementation phase.
        </p>
        <Button variant="outline" onClick={() => logout()}>
          Log out
        </Button>
      </GlassCard>
    </div>
  );
}
