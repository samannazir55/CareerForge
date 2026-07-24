import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAnalytics } from './lib/analytics';
import './index.css';

initAnalytics();

const container = document.getElementById('root')!;

// Public marketing/blog/feature routes are prerendered at build time (see
// scripts/prerender.mjs) purely so crawlers get real content and correct
// meta tags without executing JS — NOT for React hydration. Deliberately
// using createRoot (a full client render that replaces the prerendered
// markup) rather than hydrateRoot: framer-motion's whileInView/animate
// elements are captured in their post-animation "settled" state (so the
// static HTML looks right to a crawler or in a scroll-through), but that
// doesn't match the `initial` (pre-animation) state React expects to see
// on the very first client render. hydrateRoot treats that mismatch as an
// error — it was throwing React errors #418/#423/#425 on every real page
// load, repeatedly, before recovering. createRoot sidesteps hydration
// entirely: no matching attempted, no mismatch possible.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
