import { type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Store,
  Settings,
  Coins,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUIStore } from '../../store/ui.store';
import { pointsApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface AppShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/resumes', label: 'Resumes', icon: FileText },
  { path: '/jobs', label: 'Job Tracker', icon: ClipboardList },
  { path: '/marketplace', label: 'Templates', icon: Store },
];

/**
 * App-wide top navigation, ported from the Magic Patterns TopNav pattern:
 * gradient logo mark, a pill nav with a layoutId-animated active indicator
 * that slides between tabs, a live points balance badge, and a theme
 * toggle wired to the same useUIStore the rest of the app already uses.
 *
 * Replaces the previous sidebar layout, which used raw emoji as icons and
 * had no points display, no active-state animation, and no theme control.
 */
export function AppShell({ children }: AppShellProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    pointsApi.get().then((d) => setPointsBalance(d.balance)).catch(() => undefined);
  }, []);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const activeItem = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="flex-none h-16 border-b border-border glass-panel z-50 flex items-center justify-between px-4 sm:px-6 sticky top-0">
        <div className="flex items-center gap-3 sm:gap-8">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles size={16} />
            </div>
            <span className="font-bold text-lg hidden sm:inline-block">
              <span className="text-gradient">Corvyx</span>
            </span>
          </Link>

          {/* Pill nav */}
          <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
            {NAV_ITEMS.map((item) => {
              const isActive = activeItem?.path === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'relative flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={16} />
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Points badge */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            title="Your points balance"
          >
            <Coins size={16} className="text-amber-500" />
            <span className="font-bold text-amber-600 dark:text-amber-400 text-sm tabular-nums">
              {pointsBalance ?? '—'}
            </span>
          </button>

          {/* Subscription badge */}
          {user?.subscriptionTier && user.subscriptionTier !== 'FREE' && (
            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              {user.subscriptionTier.toLowerCase()}
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon size={17} />
                </motion.span>
              ) : (
                <motion.span key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Sun size={17} className="text-amber-500" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-accent transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                {user?.fullName?.[0] ?? user?.email?.[0] ?? '?'}
              </div>
              <ChevronDown size={14} className={cn('text-muted-foreground transition-transform hidden sm:block', menuOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 glass-panel rounded-2xl p-2 z-50 shadow-xl"
                  >
                    <div className="px-3 py-2 mb-1">
                      <p className="text-sm font-medium truncate">{user?.fullName ?? 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Settings size={15} />
                      Settings
                    </Link>
                    <button
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
