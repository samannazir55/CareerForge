import { type ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  LayoutTemplate,
  CreditCard,
  Users,
  Coins,
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sun,
  Moon,
  LogOut,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LogoMark } from '../../components/ui/LogoMark';
import { useUIStore } from '../../store/ui.store';
import { cn } from '../../lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { path: '/admin/templates', label: 'Templates', icon: LayoutTemplate },
      { path: '/admin/plans', label: 'Subscription Plans', icon: CreditCard },
    ],
  },
  {
    label: 'Users',
    items: [
      { path: '/admin/users', label: 'All Users', icon: Users },
      { path: '/admin/points', label: 'Points Economy', icon: Coins },
    ],
  },
  {
    label: 'Growth',
    items: [
      { path: '/admin/seo', label: 'SEO', icon: Search },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/admin/audit', label: 'Audit Log', icon: ScrollText },
    ],
  },
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  function isActive(path: string) {
    return path === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(path);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5 border-b border-border shrink-0',
        collapsed && 'justify-center px-3',
      )}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
          <LogoMark size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-sm leading-none">Corvyx</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-5 hide-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="admin-nav-pill"
                        className="absolute inset-0 bg-accent rounded-lg border-l-2 border-indigo-500"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Icon size={17} className="relative z-10 shrink-0" />
                    {!collapsed && <span className="relative z-10">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: back to site + collapse toggle */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        <Link
          to="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Back to App' : undefined}
        >
          <ExternalLink size={16} className="shrink-0" />
          {!collapsed && <span>Back to App</span>}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-border glass-panel h-screen sticky top-0 transition-all duration-200 shrink-0',
          collapsed ? 'w-[60px]' : 'w-[220px]',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-full w-[240px] border-r border-border glass-panel z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — WordPress-style: site name, user info, quick actions */}
        <header className="h-12 border-b border-border glass-panel flex items-center justify-between px-4 gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-accent transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>

            {/* WP-style breadcrumb path */}
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Corvyx</span>
              <span>/</span>
              <span>
                {NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i.path))?.label ?? 'Admin'}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Moon size={15} /> : <Sun size={15} className="text-amber-500" />}
            </button>

            {/* User info + sign out */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="h-7 w-7 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-500 font-bold text-xs shrink-0">
                {user?.fullName?.[0] ?? user?.email?.[0] ?? 'A'}
              </div>
              <span className="text-sm font-medium hidden sm:block">{user?.fullName ?? user?.email}</span>
              <button
                onClick={() => logout().then(() => navigate('/login'))}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex-1 overflow-auto"
        >
          {children ?? <Outlet />}
        </motion.main>
      </div>
    </div>
  );
}
