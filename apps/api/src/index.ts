import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeBrowser } from './domain/export/browser.js';
import { prisma } from './lib/prisma.js';
import { startScheduler } from './lib/scheduler.js';

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  const model = env.OPENROUTER_MODEL?.split('/').pop() ?? 'unknown';
  console.log(`
┌─────────────────────────────────────┐
│  Corvyx API                         │
│  Port:    ${env.API_PORT}
│  Env:     ${env.NODE_ENV}
│  Base URL:${env.API_BASE_URL}
│  AI:      ${env.AI_PROVIDER} / ${model}
└─────────────────────────────────────┘
`);
  startScheduler();
});

// Graceful shutdown — close the Puppeteer browser and Prisma connection so
// Render's (or any host's) SIGTERM doesn't leave orphaned Chromium processes
// or open DB connections.
async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await Promise.all([closeBrowser(), prisma.$disconnect()]);
    console.log('Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
