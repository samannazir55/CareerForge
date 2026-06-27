import { Button } from '../../components/ui/Button';

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button type="button" variant="outline" onClick={() => { window.location.href = '/api/auth/oauth/google'; }}>
        Google
      </Button>
      <Button type="button" variant="outline" onClick={() => { window.location.href = '/api/auth/oauth/github'; }}>
        GitHub
      </Button>
    </div>
  );
}
