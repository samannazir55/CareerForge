# Real-time notifications — changed/new files

This zip contains **only** the files touched for the notification system, mirroring
your project's folder structure. Drop them into your `careerforge/` repo at the same
paths, overwriting the existing ones.

## New files
- `apps/api/src/lib/notify.ts` — `notify()` helper
- `apps/api/src/domain/notifications/notifications.routes.ts` — GET/PATCH/PATCH/DELETE endpoints
- `apps/web/src/components/layout/NotificationBell.tsx` — bell + dropdown UI

## Modified files
- `apps/api/prisma/schema.prisma` — added `Notification` model, `notifications` relation
  on `User`, and `viewCount` / `lastViewedAt` / `lastViewNotifiedAt` on `ShareableLink`
- `apps/api/src/app.ts` — mounts `notificationsRouter` at `/api/notifications`
- `apps/api/src/domain/points/points.service.ts` — notifies on `award()`
- `apps/api/src/domain/payments/subscription.service.ts` — notifies on all three
  webhook branches (created / updated / deleted→FREE)
- `apps/api/src/domain/interview/interview.routes.ts` — notifies when a session is saved
- `apps/api/src/domain/sharing/sharing.routes.ts` — notifies (throttled, 15 min cooldown)
  and tracks view counts on public resume views
- `apps/web/src/lib/api.ts` — `notificationsApi` + `AppNotification` type
- `apps/web/src/components/layout/AppShell.tsx` — renders `<NotificationBell />`

## After applying
Your Dockerfile already runs `prisma db push` on every container start, so the schema
changes (new `Notification` table, new `ShareableLink` columns) will apply automatically
on your next Render deploy — no manual migration needed.

Locally: `npm run prisma:generate` (or `npx prisma generate`) to regenerate the Prisma
client before running the API, since `Notification` and the new `ShareableLink` fields
are new types it doesn't know about yet.
