import { Button } from '../../components/ui/Button';

// The OAuth flow starts on the API server (which handles the redirect to
// Google/GitHub and the callback). The frontend and API are on different
// domains on Render, so we need the full API URL, not a relative path.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => { window.location.href = `${API_BASE}/api/auth/oauth/google`; }}
      >
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => { window.location.href = `${API_BASE}/api/auth/oauth/github`; }}
      >
        GitHub
      </Button>
    </div>
  );
}
