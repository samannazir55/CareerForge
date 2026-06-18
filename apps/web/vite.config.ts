import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The /api proxy makes the frontend and API appear same-origin during local
// development, which is what lets the httpOnly refresh cookie work without
// SameSite=None + HTTPS gymnastics on localhost. Production should be
// deployed behind a reverse proxy that preserves this same-origin property
// (see /docs/deployment.md) — or the cookie config in apps/api/src/lib/cookies.ts
// needs to change to SameSite=None with real HTTPS on both sides.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
