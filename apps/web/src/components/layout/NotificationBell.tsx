import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { notificationsApi, type AppNotification } from '../../lib/api';
import { cn } from '../../lib/utils';

const POLL_INTERVAL_MS = 60_000;
const PANEL_ITEM_COUNT = 10;

/** "2 minutes ago", "3 hours ago", "just now", falling back to a short date
 * once something is old enough that a relative phrase stops being useful. */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 45) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Notification bell for the top nav. Fetches on mount, polls every 60s for
 * new activity (points earned, resume views, subscription changes,
 * interview sessions), and shows an animated dropdown with the most recent
 * notifications. Matches the glass-panel / pill styling already used by the
 * user menu dropdown in AppShell.
 */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    notificationsApi
      .list()
      .then((d) => {
        setNotifications(d.notifications.slice(0, PANEL_ITEM_COUNT));
        setUnreadCount(d.unreadCount);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleOpenNotification = (notification: AppNotification) => {
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      notificationsApi.markRead(notification.id).catch(() => refresh());
    }
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    notificationsApi.markAllRead().catch(() => refresh());
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 glass-panel rounded-2xl z-50 shadow-xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <span className="text-sm font-semibold">Notifications</span>
                <button
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-10 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
                    <Inbox size={22} className="opacity-40" />
                    You're all caught up.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleOpenNotification(notification)}
                      className={cn(
                        'w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-border/30 last:border-b-0 hover:bg-accent/50 transition-colors',
                        !notification.isRead && 'bg-indigo-500/5',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 rounded-full shrink-0',
                          notification.isRead ? 'bg-transparent' : 'bg-indigo-500 shadow-[0_0_6px] shadow-indigo-500/60',
                        )}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('text-sm truncate', notification.isRead ? 'font-medium text-foreground/80' : 'font-semibold text-foreground')}>
                            {notification.title}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
