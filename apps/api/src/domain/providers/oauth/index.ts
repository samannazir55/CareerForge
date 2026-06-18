import type { OAuthProvider } from './oauth.provider.js';
import { GoogleOAuthProvider } from './google.adapter.js';
import { GitHubOAuthProvider } from './github.adapter.js';

export const oauthProviders: Record<'GOOGLE' | 'GITHUB', OAuthProvider> = {
  GOOGLE: new GoogleOAuthProvider(),
  GITHUB: new GitHubOAuthProvider(),
};

export type { OAuthProvider, OAuthProfile } from './oauth.provider.js';
