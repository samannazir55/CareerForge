import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { BadRequestError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  UpdateTemplateListingRequestSchema,
  UpsertSubscriptionPlanRequestSchema,
  GrantPointsRequestSchema,
  UpdateUserRoleRequestSchema,
} from '@careerforge/schema';
import { adminTemplatesService } from './templates.service.js';
import { adminPlansService } from './plans.service.js';
import { adminUsersService } from './users.service.js';
import { adminDashboardService } from './dashboard.service.js';
import { adminAuditService } from './audit.service.js';
import { dynamicTemplatesService } from './dynamicTemplates.service.js';
import Anthropic from '@anthropic-ai/sdk';

export const adminRouter = Router();

// Every route in this router requires a valid session AND the ADMIN role.
adminRouter.use(requireAuth, requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await adminDashboardService.getStats();
    res.status(200).json(stats);
  }),
);

// ---------------------------------------------------------------------------
// Templates (code-registered)
// ---------------------------------------------------------------------------

adminRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const [codeTemplates, dynamicTemplates] = await Promise.all([
      adminTemplatesService.listAll(),
      dynamicTemplatesService.list(),
    ]);
    res.status(200).json({ templates: codeTemplates, dynamicTemplates });
  }),
);

adminRouter.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpdateTemplateListingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    }
    const listing = await adminTemplatesService.upsertListing(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ listing });
  }),
);

// ---------------------------------------------------------------------------
// Dynamic Templates — AI-generated, DB-stored
// ---------------------------------------------------------------------------

// POST /admin/templates/generate
// Calls the AI with a style prompt and returns name, slug, category, html.
// Nothing is saved yet — the admin reviews and calls POST /dynamic to persist.
adminRouter.post(
  '/templates/generate',
  asyncHandler(async (req, res) => {
    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) throw new BadRequestError('prompt is required.');

    const client = new Anthropic();

    const SYSTEM = `You are the senior template designer for CareerForge, a resume builder. You are designing a template that a real job-seeker's actual data will be poured into — not a mockup, not a proof of concept. It ships to production the moment the admin clicks Save, from a single short instruction, with no back-and-forth. Treat every generation as if it were the only chance you get: it has to be excellent on the first try.

════════════════════════════════════════════════════════════════
1. THE PLACEHOLDER CONTRACT — the only thing you're allowed to rely on
════════════════════════════════════════════════════════════════
A server-side renderer does plain string substitution on your HTML using regex.
There is no templating engine, no logic beyond what's listed here. Anything you
write outside this contract (custom tags, extra {{...}} variables, JS-driven
conditionals) will render as literal dead text or simply never fire. Study this
section like a spec, because it is one.

SCALARS — replaced with escaped plain text, safe to use anywhere:
  {{name}}       {{jobTitle}}   {{email}}      {{phone}}
  {{location}}   {{linkedin}}   {{website}}
  {{summary}}    — may contain simple inline HTML (already unescaped), treat
                   as a paragraph of prose, not a single line

LOOP BLOCKS — the block between the open/close tags repeats once per entry,
and is REMOVED ENTIRELY (not just hidden) if the user has zero entries of that
type. Design every loop's *container* (heading, divider, wrapping <section>)
to also disappear gracefully when the loop renders empty — never hardcode a
section heading outside the loop tags, or an empty "EXPERIENCE" heading with
nothing under it will appear on real resumes that skip that section.

  {{#experiences}} ... {{/experiences}}
    {{exp.title}} {{exp.company}} {{exp.location}} {{exp.dateRange}} {{exp.description}}
    (also available individually: {{exp.startDate}} {{exp.endDate}})
    exp.description may contain <br> line breaks — treat as multi-line, not
    a single sentence.

  {{#education}} ... {{/education}}
    {{edu.degree}} {{edu.school}} {{edu.dateRange}}

  {{#skills}} ... {{/skills}}
    {{skill.name}} — one iteration per skill; design this as a repeatable
    chip/tag/row, not a paragraph, since it may repeat 3 times or 30 times.

  {{#certifications}} ... {{/certifications}}
    {{cert.name}} {{cert.issuer}} {{cert.date}}

  {{#projects}} ... {{/projects}}
    {{project.name}} {{project.description}} {{project.url}}
    project.description may contain <br>.

  {{#languages}} ... {{/languages}}
    {{lang.name}} {{lang.proficiency}}

  {{#references}} ... {{/references}}
    {{ref.name}} {{ref.relationship}} {{ref.contact}}

  {{#customSections}} ... {{/customSections}}
    A user-defined section your template has no fixed schema for (e.g.
    "Publications", "Volunteer Work" — whatever they typed as a heading).
    {{section.title}} is the heading they chose.
    Nested loop, one row per entry in that section:
      {{#entries}} ... {{/entries}}
        {{entry.fields}} — every field of that entry, PRE-RENDERED as HTML:
          <div class="cf-field"><span class="cf-field-label">Label:</span> value</div>
          (or, for a long-text field: <div class="cf-field cf-field--richtext">...)
        You cannot access individual field names or values here — only the
        whole pre-rendered block. What you CAN and SHOULD do is style it:
        add real CSS rules for .cf-field, .cf-field-label, and
        .cf-field--richtext so custom sections inherit your template's type
        and spacing instead of rendering as unstyled black browser-default
        text. This is not optional polish — every template must style these
        three classes, because any resume can contain a custom section.

CONDITIONALS — {{#if key}} ... {{/if key}} — ONLY works on the SCALAR keys
above (linkedin, website, phone, location, summary, jobTitle). It does NOT
work inside a loop and does NOT work on loop-item fields — {{#if exp.location}}
will not fire; do not write it, it will render as broken literal text.
Use conditionals for things that might not exist at all on the person, e.g.:
  {{#if linkedin}}<a href="{{linkedin}}">{{linkedin}}</a>{{/if linkedin}}
  {{#if website}}<span class="sep">{{website}}</span>{{/if website}}

LOOP-ITEM FIELDS CAN'T BE CONDITIONALLY HIDDEN — exp.location, cert.issuer,
project.url, lang.proficiency, ref.relationship, ref.contact can all be an
empty string on a per-entry basis, with no {{#if}} available inside a loop
to hide them. Never hardcode a separator glyph next to one of these fields —
"{{exp.location}} · {{exp.dateRange}}" will render "· Jan 2020 – Present"
with a dangling bullet when location is blank. Instead, put the separator
INSIDE the same inline element as the optional value and hide it with CSS
:empty, which is the standard, required pattern for every optional loop field:

    <span class="sep">{{exp.location}}</span>
    .sep:not(:empty)::before { content: " · "; opacity: .6; }

Apply this :empty pattern to every optional loop-item field you display
inline (exp.location, cert.issuer, project.url, lang.proficiency,
ref.relationship, ref.contact). Never wrap project.url in an <a href="">
tag — it can be blank, producing a broken empty link — display it as plain
text with the :empty pattern instead.

════════════════════════════════════════════════════════════════
2. WHERE THIS ACTUALLY RENDERS — non-negotiable production constraints
════════════════════════════════════════════════════════════════
- Your output is rendered by headless Chrome (Puppeteer) straight to PDF via
  page.pdf({ format: 'A4', margin: 0, printBackground: true }). The 0 margin
  is set at the PDF level — YOUR page's own body/container padding is the
  ONLY page margin that will exist, so you must set real padding (28–48px is
  a good range) on the outermost content wrapper yourself, on every side.
- Design for a fixed CONTENT WIDTH of 794px (A4 at 96dpi) but NEVER a fixed
  height. A resume with a long work history must be allowed to flow onto a
  second PDF page. Do not set height, min-height: 100vh, or overflow:hidden
  on the outer wrapper or on any section — that clips real content off the
  page. Let the document grow downward naturally.
- Add these two CSS rules on body (belt-and-braces alongside printBackground):
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  Colored sidebars, tag backgrounds, and header bands will print faded or
  vanish entirely without this.
- Repeating entry blocks (one experience entry, one education entry, one
  project, etc.) must have break-inside: avoid on their container so Chrome
  never slices a single job entry in half across a page boundary. Section
  headings should have break-after: avoid so a heading never lands alone at
  the bottom of a page with its content pushed to the next one.
- If you use a colored full-height sidebar (two-column layout), do NOT use
  position: fixed or position: absolute for it — that breaks / duplicates
  incorrectly across multi-page PDFs. Build it as a normal-flow flex/grid
  column so it paginates the same way the main column does.
- Fonts: @import from Google Fonts is fine (the render step waits for
  network idle before printing) — but ALWAYS declare a full local fallback
  stack after it, e.g. font-family: 'Fraunces', Georgia, 'Times New Roman',
  serif; A slow or failed font fetch must never break layout, only typeface.
  Limit yourself to 1–2 font families and at most 3 weights total — every
  extra @import is extra latency on every single export a user makes.
- Zero <script> tags, zero JS. Zero external resources other than Google
  Fonts — no icon-font CDNs, no external image URLs, no analytics, nothing
  that can 404, get blocked, or hang the render.
- If you want icons or decorative marks (section dividers, a small dot,
  a checkmark), use tiny inline SVG or CSS-drawn shapes (borders, ::before/
  ::after) — never emoji as a substitute for iconography, and never an
  external icon font.

════════════════════════════════════════════════════════════════
3. DESIGN JUDGMENT — you get one short instruction, make a real decision
════════════════════════════════════════════════════════════════
The admin's prompt will often be a single line ("modern minimalist, teal
accent" / "bold and creative for a designer" / just "executive"). You will
not get to ask a follow-up. That means YOU own every decision the prompt
doesn't make, and you should make it like a working designer would — with a
specific point of view — not by falling back to generic centered-Helvetica-
on-white "default resume" styling. A blank or vague prompt is not permission
to be safe; it's permission to be tasteful and opinionated on the designer's
behalf. Two different one-line prompts should never produce templates that
feel like reskins of each other.

Work through these decisions explicitly before you write a line of HTML:

  a) LAYOUT ARCHETYPE — pick one deliberately, don't default to the same one
     every time:
     - Single-column classic: centered header, full-width sections stacked,
       generous whitespace. Reads as timeless/traditional.
     - Sidebar (left or right): a narrower colored or tinted column for
       contact info / skills / languages, wider main column for experience.
       Reads as modern/structured.
     - Header band + two-column body: a full-width colored header strip
       (name/title/contact), then the body splits into two columns below it.
     - Timeline/rule-driven: a vertical rule or line of dots down one side
       marking chronology, entries branch off it. Reads as narrative/creative.
     - Compact/dense: tight line-height, small but legible type, minimal
       decoration — optimized for fitting a lot of content cleanly. Reads as
       senior/technical/ATS-conscious.
     Let the admin's words steer this if they gave any hint ("creative" →
     timeline or asymmetric header band; "executive" → single-column classic
     or a restrained sidebar; "engineer/technical" → compact/dense;
     "minimalist" → single-column with a lot of whitespace, not sidebar).

  b) TYPE SYSTEM — choose a real pairing, not "system-ui for everything":
     a serif or slab-serif display face for the name/headings paired with a
     clean sans for body copy, OR a single well-chosen sans used at
     distinct weights/sizes for hierarchy. Set a clear type scale (name
     largest, section headings a clear step down, body text legible at
     10.5–12px for print). Avoid ultra-thin display weights that print badly
     small — job titles and section headings should be at least medium
     weight so they photocopy/scan/screen well.

  c) COLOR SYSTEM — one accent hue plus a small neutral set (near-black
     text, one or two grays, white/off-white background) — three or four
     colors total, not a rainbow. The accent should do real work (section
     rules, one background block, link color, a tag background) not just
     tint one word. Body text must hit at least 4.5:1 contrast against its
     background — decorative elements can be lighter, body copy cannot.

  d) DENSITY & WHITESPACE — decide how much information this template is
     built to hold gracefully. A dense/compact template should still have
     comfortable line-height (1.4+) even at small font sizes. A spacious
     template should not leave a person with 3 jobs looking like they have
     nothing to say — balance margins so short resumes don't look empty and
     long ones don't look cramped; this is exactly why you must never fix
     the container height (see §2).

Whatever you choose, execute it consistently: the same spacing rhythm, the
same heading treatment, and the same accent usage across summary, experience,
education, skills, certifications, projects, languages, references, and
custom sections. A template that looks polished in "Experience" and then
reverts to plain black bullet text in "Projects" reads as unfinished — see
§1's requirement to style .cf-field for the same reason.

════════════════════════════════════════════════════════════════
4. SELF-CHECK BEFORE YOU OUTPUT
════════════════════════════════════════════════════════════════
Before responding, verify silently:
  [ ] All 9 loop blocks are present (experiences, education, skills,
      certifications, projects, languages, references, customSections) —
      every one, even if the admin's prompt only mentioned "experience and
      education." A resume that has projects must never lose them because a
      template forgot the block.
  [ ] .cf-field / .cf-field-label / .cf-field--richtext are styled in <style>.
  [ ] No {{#if}} used inside a loop or on a loop-item field.
  [ ] Every optional inline loop field (exp.location, cert.issuer,
      project.url, lang.proficiency, ref.relationship, ref.contact) uses the
      :empty separator pattern from §1, not a hardcoded separator.
  [ ] project.url is plain text, never inside <a href="">.
  [ ] No fixed height / min-height:100vh / overflow:hidden on the outer
      wrapper or any section.
  [ ] break-inside: avoid on repeating entry blocks; break-after: avoid on
      section headings.
  [ ] -webkit-print-color-adjust / print-color-adjust: exact on body.
  [ ] Every font-family has a real fallback after the Google Font.
  [ ] No <script>, no external non-font resources.
  [ ] Body text contrast is at least 4.5:1.

════════════════════════════════════════════════════════════════
5. OUTPUT FORMAT — follow exactly, nothing else in your response
════════════════════════════════════════════════════════════════
Do not use JSON. Respond with EXACTLY these five sections, in this order,
each starting on its own line with the marker shown (all-caps, three equals
signs on each side, nothing else on that line). No preamble, no markdown
fences, no commentary before, between, or after the sections.

===NAME===
A short display name for the template, e.g. Executive Dark
===SLUG===
a-url-safe-slug, lowercase, hyphens only, e.g. executive-dark
===CATEGORY===
free
(or: premium — use "premium" only for a template with real production
effort, like a bespoke two-tone sidebar layout or intricate custom
typography; a plain single-column layout should be "free")
===HTML===
<!doctype html>
...the complete, self-contained HTML document, starting with <!doctype html>
and ending with </html>. Nothing after it.
===END===`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    const raw = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Delimiter-based parsing rather than JSON: the HTML payload is several
    // KB of markup containing quotes, backticks, and newlines — asking the
    // model to JSON-escape all of that inside a JSON string was the single
    // biggest source of "AI returned malformed JSON" failures. Plain-text
    // sentinel markers have nothing to escape and are far more reliable for
    // a one-shot generation.
    function extractSection(text: string, tag: string): string | null {
      const re = new RegExp(`===${tag}===\\s*\\n([\\s\\S]*?)(?=\\n===[A-Z]+===|$)`);
      const match = text.match(re);
      return match ? match[1].trim() : null;
    }

    const name = extractSection(raw, 'NAME');
    const slugRaw = extractSection(raw, 'SLUG');
    const categoryRaw = extractSection(raw, 'CATEGORY');
    const html = extractSection(raw, 'HTML');

    if (!name || !slugRaw || !html) {
      throw new BadRequestError(
        'AI response was missing required sections. Try again, or use a more specific prompt.',
      );
    }

    res.status(200).json({
      name,
      slug:     slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      category: categoryRaw?.trim().toLowerCase() === 'premium' ? 'premium' : 'free',
      html,
    });
  }),
);

// POST /admin/templates/preview
// Renders a raw HTML template string with hardcoded sample data so the admin
// can see what it looks like before saving. Returns text/html.
adminRouter.post(
  '/templates/preview',
  asyncHandler(async (req, res) => {
    const { html } = req.body as { html?: string };
    if (!html?.trim()) throw new BadRequestError('html is required.');

    const { renderDynamicTemplate } = await import('./dynamicTemplateRenderer.js');

    // Hardcoded sample resume — mirrors the frontend SAMPLE_RESUME
    const sampleResume = {
      id: 'preview',
      ownerId: '',
      title: 'Alex Morgan',
      theme: { templateId: 'preview', accentColor: '#6366f1' },
      schemaVersion: 1,
      migrationVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: 's1', type: 'summary', title: 'Summary', order: 0, fields: [], entries: [{
            id: 'e1', values: {
              jobTitle: 'Senior Software Engineer', email: 'alex.morgan@email.com',
              phone: '+1 (555) 234-5678', location: 'San Francisco, CA',
              linkedin: 'linkedin.com/in/alexmorgan', website: 'alexmorgan.dev',
              text: 'Full-stack engineer with 7+ years building scalable web products. Passionate about clean architecture and shipping software users love.',
            },
          }],
        },
        {
          id: 's2', type: 'experience', title: 'Experience', order: 1, fields: [], entries: [
            { id: 'e2', values: { title: 'Senior Software Engineer', company: 'Stripe', location: 'San Francisco, CA', startDate: '2021-06', endDate: '', description: 'Led development of the next-generation payments dashboard serving 2M+ merchants.\nReduced API latency by 40% through query optimisation.' } },
            { id: 'e3', values: { title: 'Software Engineer', company: 'Accenture', location: 'New York, NY', startDate: '2018-08', endDate: '2021-05', description: 'Built microservices architecture for a Fortune 500 retail client.' } },
          ],
        },
        {
          id: 's3', type: 'education', title: 'Education', order: 2, fields: [], entries: [
            { id: 'e4', values: { degree: 'B.S. Computer Science', school: 'Carnegie Mellon University', startDate: '2014-09', endDate: '2018-05' } },
          ],
        },
        {
          id: 's4', type: 'skills', title: 'Skills', order: 3, fields: [], entries: [
            { id: 'e5', values: { name: 'TypeScript / JavaScript' } },
            { id: 'e6', values: { name: 'React & Next.js' } },
            { id: 'e7', values: { name: 'Node.js' } },
            { id: 'e8', values: { name: 'PostgreSQL' } },
            { id: 'e9', values: { name: 'AWS' } },
          ],
        },
        {
          id: 's5', type: 'certifications', title: 'Certifications', order: 4, fields: [], entries: [
            { id: 'e10', values: { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', date: '2023-06' } },
          ],
        },
        {
          id: 's6', type: 'projects', title: 'Projects', order: 5, fields: [], entries: [
            { id: 'e11', values: { name: 'OpenPay', description: 'Open-source payments SDK with 3k+ GitHub stars.', url: 'github.com/alexmorgan/openpay' } },
          ],
        },
        {
          id: 's7', type: 'languages', title: 'Languages', order: 6, fields: [], entries: [
            { id: 'e12', values: { name: 'English', proficiency: 'Native' } },
            { id: 'e13', values: { name: 'Spanish', proficiency: 'Professional working proficiency' } },
          ],
        },
        {
          id: 's8', type: 'references', title: 'References', order: 7, fields: [], entries: [
            { id: 'e14', values: { name: 'Jordan Lee', relationship: 'Former Manager, Stripe', contact: 'jordan.lee@email.com' } },
          ],
        },
        {
          id: 's9', type: 'custom', title: 'Volunteering', order: 8,
          fields: [
            { key: 'org', label: 'Organization', kind: 'text', required: false },
            { key: 'role', label: 'Role', kind: 'text', required: false },
          ],
          entries: [{ id: 'e15', values: { org: 'Code.org', role: 'Volunteer Mentor' } }],
        },
      ],
    };

    const rendered = renderDynamicTemplate(html, sampleResume as any);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(rendered);
  }),
);

// POST /admin/templates/dynamic  — persist a generated (or hand-crafted) template
adminRouter.post(
  '/templates/dynamic',
  asyncHandler(async (req, res) => {
    const { name, slug, category, templateHtml, thumbnailUrl, pointsCost, displayOrder, promptUsed } =
      req.body as Record<string, string | number | undefined>;

    if (!name || !slug || !templateHtml) {
      throw new BadRequestError('name, slug, and templateHtml are required.');
    }

    const template = await dynamicTemplatesService.create(req.user!.id, {
      name:         String(name),
      slug:         String(slug),
      category:     String(category ?? 'free'),
      templateHtml: String(templateHtml),
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : undefined,
      pointsCost:   pointsCost   ? Number(pointsCost)  : 0,
      displayOrder: displayOrder ? Number(displayOrder) : 0,
      promptUsed:   promptUsed   ? String(promptUsed)  : undefined,
    });

    res.status(201).json({ template });
  }),
);

// PUT /admin/templates/dynamic/:id
adminRouter.put(
  '/templates/dynamic/:id',
  asyncHandler(async (req, res) => {
    const template = await dynamicTemplatesService.update(req.user!.id, req.params.id, req.body);
    res.status(200).json({ template });
  }),
);

// DELETE /admin/templates/dynamic/:id
adminRouter.delete(
  '/templates/dynamic/:id',
  asyncHandler(async (req, res) => {
    await dynamicTemplatesService.delete(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

adminRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await adminPlansService.listAll();
    res.status(200).json({ plans });
  }),
);

adminRouter.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const plan = await adminPlansService.create(req.user!.id, parsed.data);
    res.status(201).json({ plan });
  }),
);

adminRouter.put(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const parsed = UpsertSubscriptionPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const plan = await adminPlansService.update(req.user!.id, req.params.id, parsed.data);
    res.status(200).json({ plan });
  }),
);

adminRouter.delete(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    await adminPlansService.delete(req.user!.id, req.params.id);
    res.status(200).json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { search, role, tier, page, pageSize } = req.query;
    const result = await adminUsersService.list({
      search:   typeof search === 'string' ? search : undefined,
      role:     role === 'USER' || role === 'ADMIN' ? role : undefined,
      tier:     tier === 'FREE' || tier === 'PROFESSIONAL' || tier === 'PREMIUM' ? tier : undefined,
      page:     page     ? Math.max(1, parseInt(String(page),     10) || 1) : undefined,
      pageSize: pageSize ? Math.min(100, parseInt(String(pageSize), 10) || 25) : undefined,
    });
    res.status(200).json(result);
  }),
);

adminRouter.post(
  '/users/grant-points',
  asyncHandler(async (req, res) => {
    const parsed = GrantPointsRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const newBalance = await adminUsersService.grantPoints(req.user!.id, parsed.data);
    res.status(200).json({ newBalance });
  }),
);

adminRouter.post(
  '/users/role',
  asyncHandler(async (req, res) => {
    const parsed = UpdateUserRoleRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input.');
    const result = await adminUsersService.updateRole(req.user!.id, parsed.data);
    res.status(200).json(result);
  }),
);

// ---------------------------------------------------------------------------
// Points economy
// ---------------------------------------------------------------------------

adminRouter.get(
  '/points/transactions',
  asyncHandler(async (req, res) => {
    const rawLimit = parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;

    const transactions = await prisma.pointsTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, fullName: true } } },
    });

    res.status(200).json({
      transactions: transactions.map((t) => ({
        id:          t.id,
        userId:      t.userId,
        userEmail:   t.user.email,
        userFullName:t.user.fullName,
        type:        t.type,
        amount:      t.amount,
        earnReason:  t.earnReason   ?? null,
        spendReason: t.spendReason  ?? null,
        description: t.description  ?? null,
        createdAt:   t.createdAt.toISOString(),
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

adminRouter.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 1000) : 200;
    const entries = await adminAuditService.list(limit);
    res.status(200).json({ entries });
  }),
);