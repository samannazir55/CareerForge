const STORAGE_KEY = 'cf_referral_code';

/**
 * Captures ?ref=CODE from the current URL into localStorage, first-touch
 * only — if a code is already stored, this is a no-op. That matters
 * because someone might land via a friend's referral link, browse around,
 * then later click a completely different link (their own share, an ad,
 * whatever) that happens to have no ref param or a different one; the
 * original referral should still get credit rather than being silently
 * overwritten by whatever URL they last loaded.
 */
export function captureReferralCode(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, ref.trim());
    }
  } catch {
    // localStorage can throw in some privacy/incognito modes — referral
    // attribution is a nice-to-have, never worth breaking page load over.
  }
}

export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
