/**
 * One-off seed script: inserts the "Executive Photo" dynamic template
 * (apps/api/scripts/seed-templates/executive-photo.html) into Postgres as a
 * DynamicTemplate row, via the exact same create-path the admin panel uses
 * (dynamicTemplatesService.create) — so slug validation, HTML-tag
 * validation, and audit logging all still apply, same as
 * bulkGenerateTemplates.ts.
 *
 * This template is the first one in the catalog that uses the resume
 * photo-upload feature ({{#photoUrl}}/{{^photoUrl}} in
 * dynamicTemplateRenderer.ts), so it can't just live as a code template in
 * packages/templates — it has to go through the DynamicTemplate table like
 * every other admin/AI-authored template.
 *
 * USAGE
 *   cd apps/api
 *   npx tsx scripts/seedExecutivePhotoTemplate.ts [--admin-email=you@example.com] [--slug=executive-photo]
 *
 * Safe to re-run: if a template with the target slug already exists, the
 * script updates its templateHtml in place instead of erroring, so this can
 * double as "redeploy the latest version of this template's markup."
 */

import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { dynamicTemplatesService } from '../src/domain/admin/dynamicTemplates.service.js';

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.slice(2).split('=');
    out[key] = value ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ADMIN_EMAIL = typeof args['admin-email'] === 'string' ? args['admin-email'] : undefined;
const SLUG = typeof args['slug'] === 'string' ? args['slug'] : 'executive-photo';

async function main() {
  const admin = ADMIN_EMAIL
    ? await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    : await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  if (!admin) {
    throw new Error(
      ADMIN_EMAIL
        ? `No user found with email "${ADMIN_EMAIL}".`
        : 'No ADMIN user found in the database — pass --admin-email=you@example.com or create one first.',
    );
  }

  const htmlPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'seed-templates',
    'executive-photo.html',
  );
  const templateHtml = fs.readFileSync(htmlPath, 'utf-8');

  const existing = await dynamicTemplatesService.getBySlug(SLUG);

  if (existing) {
    await dynamicTemplatesService.update(admin.id, existing.id, { templateHtml });
    console.log(`Updated existing template "${existing.name}" (slug: ${SLUG}, id: ${existing.id}).`);
    return;
  }

  const template = await dynamicTemplatesService.create(admin.id, {
    name: 'Executive Photo',
    slug: SLUG,
    category: 'premium',
    family: 'executive',
    templateHtml,
    pointsCost: 0,
    displayOrder: 0,
  });

  console.log(`Created template "${template.name}" (slug: ${SLUG}, id: ${template.id}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
