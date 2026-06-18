import type { OAuthProfile, OAuthProvider } from './oauth.provider.js';
import { env } from '../../../config/env.js';
import { ConfigurationError } from '../../../lib/errors.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class GoogleOAuthProvider implements OAuthProvider {
  private assertConfigured() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      throw new ConfigurationError(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ' +
          'and GOOGLE_REDIRECT_URI — see apps/api/.env.example.',
      );
    }
  }

  getAuthorizationUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state,
      prompt: 'select_account',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<OAuthProfile> {
    this.assertConfigured();

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      throw new Error(`Google userinfo fetch failed: ${userRes.status} ${await userRes.text()}`);
    }
    const profile = (await userRes.json()) as { sub: string; email: string; name?: string };

    return {
      providerUserId: profile.sub,
      email: profile.email,
      fullName: profile.name ?? null,
    };
  }
}
