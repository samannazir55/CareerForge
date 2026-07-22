import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { initAnalytics } from './lib/analytics';
import './index.css';

initAnalytics();

const container = document.getElementById('root')!;

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Public marketing/blog/feature routes are prerendered at build time (see
// scripts/prerender.mjs) — the server already sent real, rendered markup,
// so we hydrate it in place rather than wiping and re-rendering from
// scratch. Routes that aren't prerendered (dashboard, login, etc.) serve
// an empty shell with nothing to hydrate against, so fall back to a plain
// client render there instead of tripping React's hydration-mismatch path.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
