/**
 * GA4 wiring. No-ops entirely if VITE_GA_MEASUREMENT_ID isn't set (e.g. in
 * local dev), so dev traffic never pollutes real analytics.
 *
 * Deliberately NOT a plain <script> tag in index.html: this app's CSP
 * (apps/api/src/app.ts) locks script-src to 'self' plus one specific inline
 * script hash, so an inline gtag snippet would just get silently blocked.
 * Living here as a normal bundled module sidesteps that entirely — it's
 * same-origin, same as every other chunk Vite builds.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const isEnabled = typeof GA_ID === 'string' && GA_ID.startsWith('G-');

function gtag(...args: unknown[]) {
  window.dataLayer.push(args);
}

/** Call once, at app boot. Loads gtag.js and sends the very first pageview. */
export function initAnalytics() {
  if (!isEnabled) return;

  window.dataLayer = window.dataLayer || [];
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  // Explicit consent default. Without this, gtag.js's runtime can process
  // 'config'/'event' calls internally (dataLayer looks correct, gtm.dom/
  // gtm.load fire) while silently withholding the actual network hit,
  // since Google's tag platform now expects an explicit analytics_storage
  // signal rather than assuming granted-by-default. Corvyx doesn't yet
  // have its own cookie-consent banner, so this grants consent outright
  // for all visitors — revisit if/when a real consent banner is added,
  // at which point this should reflect the visitor's actual choice
  // instead of a blanket grant.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  // send_page_view: false — we send pageviews manually via trackPageview on
  // route change instead, since GA4's automatic pageview only fires once
  // for the initial document load and this is a client-side-routed SPA.
  gtag('config', GA_ID, { send_page_view: false });
}

/** Call on every route change (see App.tsx) to record a pageview. */
export function trackPageview(path: string) {
  if (!isEnabled) return;
  gtag('event', 'page_view', { page_path: path });
}
