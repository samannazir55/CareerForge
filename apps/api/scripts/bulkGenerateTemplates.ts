/**
 * Bulk-generates dynamic resume templates and inserts them straight into
 * Postgres, using the exact same system prompt and parser as
 * POST /admin/templates/generate (imported from templateGeneration.ts, not
 * duplicated) and the exact same create-path as the admin panel
 * (dynamicTemplatesService.create, so slug validation / audit logging /
 * reserved-word checks all still apply).
 *
 * USAGE
 *   cd apps/api
 *   npx tsx scripts/bulkGenerateTemplates.ts --count=1500 --yes
 *
 * FLAGS
 *   --count=1500        how many templates to generate (default 1500)
 *   --concurrency=3      parallel AI calls in flight at once (default 3 —
 *                        raise cautiously, your configured AI_PROVIDER's
 *                        rate limits apply -- GROQ, OpenRouter, or Anthropic)
 *   --admin-email=...    which admin user to attribute these to in the
 *                        audit log (default: first ADMIN user found)
 *   --seed=42            shuffle seed for picking combinations — reuse the
 *                        same seed to get the same combination order
 *   --log=path           progress log file (default: scripts/bulk-generate-log.jsonl)
 *   --dry-run            generate + log but don't write to Postgres
 *   --yes                skip the confirmation prompt
 *
 * RESUMABILITY
 *   Every attempt (success or failure) is appended to the log file as one
 *   JSON line. On restart, combos already logged as "success" are skipped —
 *   safe to kill and re-run the same command after a crash, a rate-limit
 *   wall, or just stopping partway through on purpose. Failed combos are
 *   NOT skipped on resume — they're retried automatically, since a failure
 *   is usually transient (rate limit, a parse miss).
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_FAMILIES } from '@careerforge/schema';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { generateTemplateViaProvider } from '../src/domain/admin/templateGeneration.js';
import { dynamicTemplatesService } from '../src/domain/admin/dynamicTemplates.service.js';
import { aiProvider } from '../src/domain/ai/index.js';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : true;
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));

const COUNT = Number(args.count ?? 1500);
const CONCURRENCY = Math.max(1, Number(args.concurrency ?? 3));
const SEED = Number(args.seed ?? 42);
const LOG_PATH = String(args.log ?? fileURLToPath(new URL('./bulk-generate-log.jsonl', import.meta.url)));
const DRY_RUN = Boolean(args['dry-run']);
const SKIP_CONFIRM = Boolean(args.yes);
const ADMIN_EMAIL = typeof args['admin-email'] === 'string' ? args['admin-email'] : undefined;

// ---------------------------------------------------------------------------
// Variation matrix — mirrors the "Variation Matrix" from the copy-paste
// prompt doc, with one deliberate change: there's no "color palette" column
// anymore. Templates now use {{accentColor}}/{{accentColorSoft}}/
// {{accentColorDark}} for their accent (the user's own color-picker choice),
// so baking a fixed accent hue into the generation brief would fight the
// thing this feature is for. What's left to vary here is the NEUTRAL tone —
// background/text — which the AI still owns.
// ---------------------------------------------------------------------------
const LAYOUTS = [
  'single-column classic layout',
  'left sidebar layout',
  'right sidebar layout',
  'header band with two-column body layout',
  'timeline layout with a vertical rule marking chronology',
  'compact, dense layout',
  'asymmetric offset-header layout',
  'magazine-style masthead layout',
];

const NEUTRAL_TONES = [
  'warm cream background with espresso-brown text',
  'cool white background with near-black text',
  'soft dove-gray background with charcoal text',
  'dark charcoal background with warm off-white text',
  'true black background with crisp white text',
  'ivory background with deep slate text',
  'pale stone background with graphite text',
  'porcelain white background with jet-black text',
  'muted taupe background with espresso text',
  'deep navy-black background with pale gray text',
];

const TYPE_PAIRINGS = [
  'Fraunces + Inter',
  'Playfair Display + Source Sans 3',
  'Space Grotesk used solo at multiple weights',
  'Libre Baskerville + Karla',
  'Bricolage Grotesque used solo at multiple weights',
  'Cormorant Garamond + Work Sans',
  'IBM Plex Serif + IBM Plex Sans',
  'DM Serif Display + DM Sans',
  'Sora used solo at multiple weights',
  'Newsreader + Manrope',
];

const PERSONAS = [
  'a corporate finance executive',
  'a creative/design professional',
  'a software engineer (technical, dense)',
  'a healthcare professional',
  'an academic/researcher',
  'a sales & marketing professional',
  'an early-career graduate',
  'a legal professional',
  'a nonprofit & mission-driven professional',
  'a hospitality & service professional',
  'a construction & trades professional',
  'a consultant',
];

const MOODS = [
  'restrained and trustworthy',
  'bold and confident',
  'warm and approachable',
  'minimalist and quiet',
  'editorial and refined',
  'energetic and modern',
  'old-money classic',
  'Scandinavian-clean',
  'brutalist and structural',
  'handcrafted and artisanal',
];

// The real design-family taxonomy (executive/minimal/creative/academic/
// technical/luxury/portfolio/modern/classic) used to filter/tag templates
// in the marketplace. Previously this script never set `family` on the
// rows it created, so every single one silently defaulted to 'modern'
// (dynamicTemplatesService.create's fallback) regardless of what persona/
// mood it was actually generated for -- the other 8 families never got
// used by the bulk generator at all. Looping over TEMPLATE_FAMILIES here,
// and folding each family's own `brief` into the generation prompt (the
// same brief text the admin panel's family dropdown uses to steer a
// manual generation), keeps the *label* and the *actual design* in sync
// instead of tagging an arbitrary layout as a family it doesn't resemble.
const FAMILIES = TEMPLATE_FAMILIES;

const TOTAL_COMBOS =
  LAYOUTS.length * NEUTRAL_TONES.length * TYPE_PAIRINGS.length * PERSONAS.length * MOODS.length * FAMILIES.length;

// Three point tiers premium templates rotate through. Previously every row
// got pointsCost=0 because this script never passed pointsCost to create()
// at all -- dynamicTemplatesService.create's `input.pointsCost ?? 0`
// fallback silently applied to all 1500 rows. Free-category templates
// still cost 0 regardless (handled in the worker below); this only applies
// to rows the AI marks as 'premium'.
const PREMIUM_POINT_TIERS = [40, 45, 50];

/** Deterministic per-index pick so re-running with the same --seed
 * reproduces the same point assignment too, not just the same combos. */
function pointsForIndex(index: number): number {
  const rand = mulberry32(index + 1);
  return PREMIUM_POINT_TIERS[Math.floor(rand() * PREMIUM_POINT_TIERS.length)];
}

function comboAt(index: number): { brief: string; key: string; familyId: string } {
  let n = index;
  const family = FAMILIES[n % FAMILIES.length]; n = Math.floor(n / FAMILIES.length);
  const mood = MOODS[n % MOODS.length]; n = Math.floor(n / MOODS.length);
  const persona = PERSONAS[n % PERSONAS.length]; n = Math.floor(n / PERSONAS.length);
  const type = TYPE_PAIRINGS[n % TYPE_PAIRINGS.length]; n = Math.floor(n / TYPE_PAIRINGS.length);
  const tone = NEUTRAL_TONES[n % NEUTRAL_TONES.length]; n = Math.floor(n / NEUTRAL_TONES.length);
  const layout = LAYOUTS[n % LAYOUTS.length];

  const brief =
    `${family.label} family (${family.brief}) — ${layout}, ${tone}, ${type} typography, ` +
    `for ${persona}, ${mood} mood.`;
  return { brief, key: `${index}`, familyId: family.id };
}

// Deterministic seeded shuffle (mulberry32) — same --seed always produces
// the same combination order, so a resumed run and a fresh run with the
// same seed pick combos in the same sequence.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffledIndices(total: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const arr = Array.from({ length: total }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Log file (JSONL, append-only, one line per attempt)
// ---------------------------------------------------------------------------
type LogEntry = {
  comboKey: string;
  status: 'success' | 'failed';
  name?: string;
  slug?: string;
  error?: string;
  timestamp: string;
};

function readCompletedKeys(logPath: string): Set<string> {
  const done = new Set<string>();
  if (!fs.existsSync(logPath)) return done;
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.status === 'success') done.add(entry.comboKey);
    } catch {
      // ignore malformed lines (e.g. a partially-written line from a crash)
    }
  }
  return done;
}

function appendLog(logPath: string, entry: LogEntry) {
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirm(message: string): Promise<boolean> {
  if (SKIP_CONFIRM) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => rl.question(message, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Variation matrix has ${TOTAL_COMBOS.toLocaleString()} possible combinations.`);

  if (COUNT > TOTAL_COMBOS) {
    console.error(
      `--count=${COUNT} exceeds the ${TOTAL_COMBOS} unique combinations available. ` +
      `Lower --count, or widen the matrix in this script.`,
    );
    process.exit(1);
  }

  const admin = ADMIN_EMAIL
    ? await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    : await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (!admin) {
    console.error(
      ADMIN_EMAIL
        ? `No user found with email "${ADMIN_EMAIL}".`
        : 'No ADMIN user found in the database — pass --admin-email=you@example.com or create one first.',
    );
    process.exit(1);
  }

  const maxOrder = await prisma.dynamicTemplate.aggregate({ _max: { displayOrder: true } });
  let nextDisplayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const completed = readCompletedKeys(LOG_PATH);
  const order = seededShuffledIndices(TOTAL_COMBOS, SEED).slice(0, COUNT);
  const pending = order.filter((i) => !completed.has(String(i)));

  console.log(`Target: ${COUNT} templates. Already logged as done: ${order.length - pending.length}. Remaining: ${pending.length}.`);
  console.log(`Attributing to admin: ${admin.email} (${admin.id})`);
  console.log(`Concurrency: ${CONCURRENCY}  ·  Log file: ${LOG_PATH}  ·  Dry run: ${DRY_RUN}`);
  console.log(
    `\nHeads up: this makes ${pending.length} calls to your configured AI provider with a ~16k output-token ` +
    `ceiling each. That's a real, non-trivial API cost/quota usage and will likely take multiple hours at this ` +
    `concurrency — check your provider's current pricing/rate limits before committing to a large --count, ` +
    `and consider a small test run first ` +
    `(--count=5 --yes) to sanity-check output before spending the full budget.\n`,
  );

  if (pending.length === 0) {
    console.log('Nothing to do — all target combinations are already logged as successful.');
    return;
  }

  const proceed = await confirm(`Proceed with ${pending.length} generations? [y/N] `);
  if (!proceed) {
    console.log('Aborted.');
    return;
  }

  let cursor = 0;
  let successCount = 0;
  let failCount = 0;
  const startedAt = Date.now();

  async function worker(workerId: number) {
    while (true) {
      const myIndex = cursor++;
      if (myIndex >= pending.length) return;
      const comboIndex = pending[myIndex];
      const { brief, key, familyId } = comboAt(comboIndex);

      const label = `[${myIndex + 1}/${pending.length}]`;
      let lastError: unknown;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const generated = await generateTemplateViaProvider(aiProvider, brief);

          if (DRY_RUN) {
            console.log(`${label} ✓ (dry-run) "${generated.name}" — ${brief}`);
            appendLog(LOG_PATH, {
              comboKey: key, status: 'success', name: generated.name, slug: generated.slug,
              timestamp: new Date().toISOString(),
            });
            successCount++;
            break;
          }

          // Slug collisions are possible even with distinct briefs (the
          // model might independently land on the same short slug twice
          // across 1500 calls) — retry with a numeric suffix a few times
          // before giving up on this combo entirely.
          let created = null;
          let slugAttempt = generated.slug;
          for (let s = 0; s < 5 && !created; s++) {
            try {
              created = await dynamicTemplatesService.create(admin.id, {
                name: generated.name,
                slug: slugAttempt,
                category: generated.category,
                family: familyId,
                pointsCost: generated.category === 'premium' ? pointsForIndex(comboIndex) : 0,
                templateHtml: generated.html,
                promptUsed: brief,
                displayOrder: nextDisplayOrder++,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes('already exists') && s < 4) {
                slugAttempt = `${generated.slug}-${s + 2}`;
                continue;
              }
              throw err;
            }
          }

          if (!created) throw new Error('Could not find a free slug after 5 attempts.');

          console.log(`${label} ✓ "${created.name}" (${created.slug}) — worker ${workerId}`);
          appendLog(LOG_PATH, {
            comboKey: key, status: 'success', name: created.name, slug: created.slug,
            timestamp: new Date().toISOString(),
          });
          successCount++;
          break;
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (attempt < 3) {
            const backoffMs = attempt * 3000;
            console.warn(`${label} attempt ${attempt} failed (${msg}) — retrying in ${backoffMs}ms`);
            await sleep(backoffMs);
          }
        }
      }

      if (lastError) {
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        console.error(`${label} ✗ giving up: ${msg}`);
        appendLog(LOG_PATH, { comboKey: key, status: 'failed', error: msg, timestamp: new Date().toISOString() });
        failCount++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `\nDone in ${elapsedMin} min. ${successCount} created, ${failCount} failed. ` +
    (failCount > 0 ? `Re-run the same command to retry the failed ones (they're not marked done in the log).` : ''),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());