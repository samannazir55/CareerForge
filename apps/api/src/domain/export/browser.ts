/**
 * Puppeteer browser singleton.
 *
 * One Browser instance is launched when the API server starts and is reused
 * across all export requests — a fresh page per request, closed after use.
 * This avoids the multi-second cold-start that a new Chromium process per
 * request would incur, while keeping memory predictable (pages don't accumulate).
 *
 * The browser is shut down cleanly in the SIGTERM/SIGINT handlers in index.ts
 * so Render's graceful shutdown doesn't leave orphaned Chromium processes.
 *
 * puppeteer-core is used rather than the full `puppeteer` package because
 * the full package bundles a Chromium binary (~300 MB) which bloats the
 * deploy image. In production, set PUPPETEER_EXECUTABLE_PATH to the system
 * Chromium binary (e.g. /usr/bin/chromium-browser on Ubuntu/Render).
 * For local development, install Chromium via `npx puppeteer browsers install chrome`
 * and set the path accordingly — or use the CHROME_PATH env var.
 */
import { env } from '../../config/env.js';

// Lazy import so the module can be loaded without the binary being present at
// startup — the error surfaces only when an export is actually attempted.
let _browserPromise: Promise<import('puppeteer-core').Browser> | null = null;

export async function getBrowser(): Promise<import('puppeteer-core').Browser> {
  if (!_browserPromise) {
    _browserPromise = (async () => {
      const { launch } = await import('puppeteer-core');
      const executablePath = env.PUPPETEER_EXECUTABLE_PATH;
      if (!executablePath) {
        throw new Error(
          'PUPPETEER_EXECUTABLE_PATH is not set. Set it to the path of a Chromium or ' +
            'Chrome binary. For local dev: `npx puppeteer browsers install chrome` then ' +
            'set PUPPETEER_EXECUTABLE_PATH to the printed path.',
        );
      }
      return launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // avoids /dev/shm size issues in containers
          '--disable-gpu',
          // Render's container restricts the syscalls Chrome's zygote process
          // uses to adjust a forked renderer's OOM score — without this flag,
          // launch fails outright with "Failed to adjust OOM score of
          // renderer ... Permission denied (13)" before ever reaching a
          // working page. --no-zygote skips that fork model entirely.
          '--no-zygote',
          // On a memory-constrained container (e.g. Render's free 512MB
          // tier), Chrome's normal multi-process model (separate zygote,
          // GPU, and renderer processes) can get OOM-killed by the
          // container before it ever finishes launching, with no specific
          // Chrome-side error message — just a bare "Failed to launch the
          // browser process!" after the usual harmless dbus/crashpad
          // noise. --single-process runs everything in one OS process,
          // cutting the memory footprint substantially. Trade-off: PDF
          // renders are serialized rather than parallel across concurrent
          // export requests — an acceptable cost for this feature's
          // traffic level, and worth it if it's what makes launch succeed
          // at all on a constrained plan.
          '--single-process',
          // The rest of this list is the well-known "minimal footprint" flag
          // set used by chrome-aws-lambda and similar Puppeteer-on-a-
          // constrained-container setups — each one turns off a subsystem
          // Chrome would otherwise initialize (background networking,
          // extensions, sync, translate, default-apps, software rasterizer
          // fallback, audio) that isn't needed for headless PDF rendering
          // but still costs memory to set up.
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-renderer-backgrounding',
          '--disable-software-rasterizer',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          // Crash reporting isn't useful in this environment (no crashpad
          // service to report to) and its startup errors add noise to the
          // logs; this is a standard, well-supported Chromium flag.
          '--disable-crash-reporter',
        ],
      });
    })();

    // If launching fails (missing binary, container OOM, crashed on first
    // use, etc.), don't leave the rejected promise cached forever — every
    // export request after the first failure would otherwise 500 with the
    // SAME stale error until the process restarts, even after whatever
    // caused it is no longer true. Clearing it here lets the next export
    // attempt a fresh launch instead.
    _browserPromise.catch((err) => {
      console.error('[export] browser-launch error:', err);
      _browserPromise = null;
    });
  }

  const browser = await _browserPromise;
  if (!browser.isConnected()) {
    // The Chromium process died after a successful launch (OOM kill, crash,
    // etc.) — same failure mode as above, just discovered later. Clear the
    // cache and relaunch on next call rather than handing back a dead
    // browser that every subsequent page.newPage() would fail against.
    _browserPromise = null;
    return getBrowser();
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browserPromise) {
    const browser = await _browserPromise.catch((err) => {
      console.error('[export] browser-shutdown error:', err);
      return null;
    });
    await browser?.close();
    _browserPromise = null;
  }
}
