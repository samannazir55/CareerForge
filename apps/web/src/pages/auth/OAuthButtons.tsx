import { Button } from '../../components/ui/Button';
import { authApi } from '../../lib/api';

/** Shared Google/GitHub buttons for both Login and Register — both pages
 * trigger the exact same redirect-based flow, so there's one definition. */
export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          window.location.href = authApi.oauthStartUrl('google');
        }}
      >
        Google
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          window.location.href = authApi.oauthStartUrl('github');
        }}
      >
        GitHub
      </Button>
    </div>
  );
}
