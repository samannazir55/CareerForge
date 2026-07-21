import { Github } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getStoredReferralCode } from '../../lib/referral';

/** OAuth is a full-page redirect flow with no request body to carry a
 * referral code in, so it rides along as a query param instead — the API
 * relays it through a short-lived cookie across the provider round-trip
 * (see GET /api/auth/oauth/:provider in auth.routes.ts). */
function oauthUrl(provider: 'google' | 'github'): string {
  const ref = getStoredReferralCode();
  return ref ? `/api/auth/oauth/${provider}?ref=${encodeURIComponent(ref)}` : `/api/auth/oauth/${provider}`;
}

// Lucide has no official Google "G" logo icon, so it's drawn inline as a
// tiny multi-color SVG (Google's actual brand colors) rather than using a
// generic placeholder icon that wouldn't read as "Google" to anyone.
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3.01c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.6H1.27a12 12 0 0 0 0 10.8l4-3.12Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.6 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.6l4 3.12C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="border-white/15 bg-white/[0.02] text-white/90 hover:bg-white/10 gap-2"
        onClick={() => { window.location.href = oauthUrl('google'); }}
      >
        <GoogleIcon /> Google
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-white/15 bg-white/[0.02] text-white/90 hover:bg-white/10 gap-2"
        onClick={() => { window.location.href = oauthUrl('github'); }}
      >
        <Github size={16} /> GitHub
      </Button>
    </div>
  );
}
