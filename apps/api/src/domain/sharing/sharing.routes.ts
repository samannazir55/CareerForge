import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { requireAuth, requireVerifiedEmail } from '../../middleware/authGuard.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { notify } from '../../lib/notify.js';
import { runMigrations } from '@careerforge/schema';
import { resolveTemplate } from '../templates/templateResolver.js';

export const sharingRouter = Router();

// Don't fire a fresh "resume viewed" notification on every single hit —
// page refreshes, link-preview crawlers, and repeat visits within a short
// window would otherwise spam the owner with one notification per request.
// A ResumeView row is still created on every hit either way (that's what
// analytics is built on); only the notification itself is throttled.
const VIEW_NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

// Upper bound applied to any duration value a client reports, so a
// malformed or malicious beacon (e.g. someone scripting huge numbers at
// the public duration endpoint) can't blow out avgDuration in analytics.
const MAX_TRACKED_DURATION_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Appends a tiny vanilla-JS tracker to a rendered resume's HTML that
 * reports time-on-page back to the given ResumeView row via
 * navigator.sendBeacon on pagehide/visibilitychange. Public template HTML
 * varies (full documents for the two code templates, arbitrary
 * admin-authored fragments for dynamic templates) so this deliberately
 * doesn't assume a </body> tag exists — it just appends, which the browser
 * still parses and executes correctly either way.
 */
function withDurationTracker(html: string, slug: string, viewId: string): string {
  const trackUrl = `/api/public/${slug}/views/${viewId}/duration`;
  const script = `
<script>
(function () {
  var start = Date.now();
  var sent = false;
  function report() {
    if (sent) return;
    sent = true;
    var duration = Math.round((Date.now() - start) / 1000);
    var payload = JSON.stringify({ duration: duration });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(${JSON.stringify(trackUrl)}, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(${JSON.stringify(trackUrl)}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') report();
  });
  window.addEventListener('pagehide', report);
})();
</script>`;
  return html + script;
}

// Enable/create shareable link for a resume
sharingRouter.post(
  '/:resumeId/share',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const existing = await prisma.shareableLink.findUnique({ where: { resumeId } });
    if (existing) {
      await prisma.shareableLink.update({ where: { resumeId }, data: { isEnabled: true } });
      res.status(200).json({ slug: existing.slug, isEnabled: true });
      return;
    }

    const slug = randomBytes(8).toString('hex');
    const link = await prisma.shareableLink.create({ data: { resumeId, slug } });
    res.status(201).json({ slug: link.slug, isEnabled: true });
  }),
);

// Current share status — read-only. Added alongside analytics: the page
// needs to know the slug/isEnabled state on load without calling POST
// (which creates-or-re-enables) as a side effect of just opening the page,
// since that would silently flip a link the owner had deliberately
// disabled back on.
sharingRouter.get(
  '/:resumeId/share',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const row = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!row || row.ownerId !== req.user!.id) throw new NotFoundError('Resume not found.');

    const link = await prisma.shareableLink.findUnique({ where: { resumeId } });
    res.status(200).json(link ? { slug: link.slug, isEnabled: link.isEnabled } : { slug: null, isEnabled: false });
  }),
);

// Disable shareable link
sharingRouter.delete(
  '/:resumeId/share',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    await prisma.shareableLink.updateMany({
      where: { resumeId, resume: { ownerId: req.user!.id } },
      data: { isEnabled: false },
    });
    res.status(204).send();
  }),
);

// Public resume view by slug — no auth required.
//
// Route note: this router is mounted at BOTH /api/resumes (for the
// authenticated /:resumeId/share endpoints above) and /api/public (for
// this one). It used to be declared here as '/public/:slug', which under
// the /api/public mount produced /api/public/public/:slug — a dead route
// that never matched the frontend's actual request URL
// (sharingApi.publicUrl → `/api/public/${slug}`), silently 404ing on
// every public resume view. Declaring it as '/:slug' fixes that; under
// the /api/resumes mount it's shadowed by resumeRouter's own GET '/:id'
// (registered first, in app.ts) exactly as before, which is harmless
// since nothing ever calls it at that path.
sharingRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const link = await prisma.shareableLink.findUnique({
      where: { slug: req.params.slug },
      include: { resume: true },
    });

    if (!link || !link.isEnabled) throw new NotFoundError('Resume not found or link disabled.');

    const now = new Date();
    const shouldNotify =
      !link.lastViewNotifiedAt || now.getTime() - link.lastViewNotifiedAt.getTime() > VIEW_NOTIFICATION_COOLDOWN_MS;

    // Awaited (not fire-and-forget) specifically so we have the row's id to
    // hand to the client-side duration tracker below — still wrapped so a
    // DB hiccup here can never fail the actual page response.
    let viewId: string | null = null;
    try {
      const view = await prisma.resumeView.create({
        data: {
          resumeId: link.resumeId,
          viewerIp: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
          referrer: (req.headers['referer'] as string | undefined) ?? null,
        },
      });
      viewId = view.id;
    } catch (err) {
      console.error('[sharing] failed to record resume view:', err);
    }

    // Legacy denormalized counter on ShareableLink — kept alongside the new
    // per-view ResumeView rows since it's a cheap O(1) read other UI may
    // already rely on; analytics itself is computed from ResumeView.
    await prisma.shareableLink
      .update({
        where: { id: link.id },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: now,
          ...(shouldNotify ? { lastViewNotifiedAt: now } : {}),
        },
      })
      .catch(() => undefined);

    if (shouldNotify) {
      await notify(
        link.resume.ownerId,
        'resume_viewed',
        'Someone viewed your resume',
        `${link.resume.title} was just viewed`,
        { resumeId: link.resume.id, slug: link.slug },
      );
    }

    const { payload: resume } = runMigrations({
      schemaVersion: link.resume.schemaVersion,
      migrationVersion: link.resume.migrationVersion,
      payload: {
        id: link.resume.id,
        ownerId: link.resume.ownerId,
        title: link.resume.title,
        theme: link.resume.theme,
        sections: link.resume.sections,
        schemaVersion: link.resume.schemaVersion,
        migrationVersion: link.resume.migrationVersion,
        createdAt: link.resume.createdAt.toISOString(),
        updatedAt: link.resume.updatedAt.toISOString(),
      },
    });

    const template = await resolveTemplate((resume.theme as any)?.templateId ?? 'modern');
    let html = template.renderHtml(resume as any);
    if (viewId) html = withDurationTracker(html, link.slug, viewId);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }),
);

// POST (not PATCH) because navigator.sendBeacon only ever sends POST —
// this is called by the tracker script injected above, not by a person.
sharingRouter.post(
  '/:slug/views/:viewId/duration',
  asyncHandler(async (req, res) => {
    const rawDuration = Number((req.body as { duration?: unknown } | undefined)?.duration);

    if (Number.isFinite(rawDuration) && rawDuration >= 0) {
      const duration = Math.min(Math.round(rawDuration), MAX_TRACKED_DURATION_SECONDS);

      // Scope the update through the slug's own resumeId so a stranger
      // can't write a duration onto an arbitrary ResumeView id copied from
      // someone else's public page — updateMany's where clause 404s (well,
      // silently no-ops) instead of trusting viewId alone.
      const link = await prisma.shareableLink.findUnique({ where: { slug: req.params.slug } });
      if (link) {
        await prisma.resumeView
          .updateMany({
            where: { id: req.params.viewId, resumeId: link.resumeId },
            data: { duration },
          })
          .catch(() => undefined);
      }
    }

    // Beacons don't read the response — 204 unconditionally so the
    // sendBeacon call never surfaces an error in the console either way.
    res.status(204).send();
  }),
);
