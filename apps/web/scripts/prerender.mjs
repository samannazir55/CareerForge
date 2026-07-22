#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Prerender the public marketing/blog/feature pages to real static HTML.
//
// This app is a pure client-side SPA (see vite.config.ts / Dockerfile) — its
// title/description/canonical are set client-side, after the JS bundle loads,
// by <SEO> (src/components/seo/SEO.tsx). That means any crawler that doesn't
// execute JavaScript (most non-Google crawlers, including the AI bots this
// site's robots.txt explicitly welcomes) sees the same generic title/
// description on every single page.
//
// This script runs after `vite build`. It launches a real (headless) browser,
// visits each public route, waits for it to fully render, and writes the
// resulting HTML to disk at the matching path (e.g. /about -> dist/about/
// index.html). Nginx's existing `try_files $uri $uri/ ...` already serves
// nested index.html files correctly — no server config changes needed for
// routing, just the fallback fix below.
//
// Route list comes from sitemap.xml (already the maintained, authoritative
// list of public URLs) rather than a second hardcoded list that could drift.
//
// IMPORTANT: this script does NOT touch design or interactivity. Real
// browsers still load the full React app and hydrate this markup in place
// (see main.tsx) — same components, same CSS, same animations. Only the
// content of the very first HTML response changes.
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, cpSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const PORT = 4321;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getRoutesFromSitemap() {
  const xml = readFileSync(join(DIST_DIR, 'sitemap.xml'), 'utf-8');
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  return matches.map((m) => new URL(m[1]).pathname);
}

// Serves the already-built dist/ folder. Unmatched paths fall back to
// app-shell.html (the pristine, un-prerendered build output) rather than
// index.html, since index.html gets overwritten with homepage content
// partway through this script's own run.
function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = join(DIST_DIR, urlPath);

      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, 'index.html');
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(DIST_DIR, 'app-shell.html');
      }

      res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
      res.end(readFileSync(filePath));
    });
    server.listen(PORT, () => resolve(server));
  });
}

// Scrolls through the page once so framer-motion's whileInView entrance
// animations settle to their final (visible) state before we snapshot the
// DOM, rather than freezing them mid-animation or at their initial state.
async function settleEntranceAnimations(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const step = 400;
      let total = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve(undefined);
        }
      }, 60);
    });
  });
  await new Promise((r) => setTimeout(r, 300));
}

function outputPathFor(route) {
  if (route === '/') return join(DIST_DIR, 'index.html');
  return join(DIST_DIR, route.replace(/^\//, ''), 'index.html');
}

async function main() {
  if (!existsSync(join(DIST_DIR, 'index.html'))) {
    console.error('dist/index.html not found — run `vite build` before prerendering.');
    process.exit(1);
  }

  const routes = getRoutesFromSitemap();
  console.log(`Prerendering ${routes.length} routes from sitemap.xml...`);

  // Preserve the pristine SPA shell under a distinct name. Nginx falls back
  // to this (not index.html) for any route that isn't one of the public
  // ones below — e.g. /dashboard, /login — so those never inherit the
  // prerendered homepage's markup.
  cpSync(join(DIST_DIR, 'index.html'), join(DIST_DIR, 'app-shell.html'));

  const server = await startStaticServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      await settleEntranceAnimations(page);
      const html = await page.content();
      await page.close();

      const outPath = outputPathFor(route);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, html);
      console.log(`  \u2713 ${route} -> dist${outPath.slice(DIST_DIR.length)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('Prerender complete.');
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
