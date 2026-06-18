/**
 * OAuth provider abstraction. Each adapter implements the real authorization
 * code flow against its provider's real endpoints. Swapping/adding a
 * provider (e.g. LinkedIn login later) means one new adapter file.
 */
export interface OAuthProfile {
  providerUserId: string;
  email: string;
  fullName: string | null;
}

export interface OAuthProvider {
  getAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<OAuthProfile>;
}
