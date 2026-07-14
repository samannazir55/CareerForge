import type { OAuthProfile, OAuthProvider } from './oauth.provider.js';
import { env } from '../../../config/env.js';
import { ConfigurationError } from '../../../lib/errors.js';

const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const EMAILS_URL = 'https://api.github.com/user/emails';

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export class GitHubOAuthProvider implements OAuthProvider {
  private assertConfigured() {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_REDIRECT_URI) {
      throw new ConfigurationError(
        'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ' +
          'and GITHUB_REDIRECT_URI — see apps/api/.env.example.',
      );
    }
  }

  getAuthorizationUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: env.GITHUB_REDIRECT_URI,
      scope: 'read:user user:email',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<OAuthProfile> {
    this.assertConfigured();

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        redirect_uri: env.GITHUB_REDIRECT_URI,
        code,
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new Error(`GitHub token exchange returned no access_token: ${tokenData.error ?? 'unknown error'}`);
    }

    const authHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'Corvyx',
      Accept: 'application/vnd.github+json',
    };

    const userRes = await fetch(USER_URL, { headers: authHeaders });
    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.status} ${await userRes.text()}`);
    }
    const user = (await userRes.json()) as { id: number; name: string | null; email: string | null };

    // GitHub only returns `email` on the user object if the user has made it
    // public. Otherwise we fetch the verified primary email explicitly.
    let email = user.email;
    if (!email) {
      const emailsRes = await fetch(EMAILS_URL, { headers: authHeaders });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as GitHubEmail[];
        const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
        email = primary?.email ?? null;
      }
    }

    if (!email) {
      throw new Error('Could not determine a verified email address from GitHub.');
    }

    return {
      providerUserId: String(user.id),
      email,
      fullName: user.name,
    };
  }
}
