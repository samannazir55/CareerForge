import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, LayoutDashboard, Store, PenTool, Moon, Sun, LogOut, LogIn, Crown, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopNavProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const NAV_ITEMS = [
  { path: '/editor', label: 'Builder', icon: <PenTool size={13} /> },
  { path: '/marketplace', label: 'Templates', icon: <Store size={13} /> },
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={13} /> },
];

export const TopNav = ({ theme, onToggleTheme }: TopNavProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const planBadge: Record<string, string> = {
    professional: 'Pro',
    premium: 'Premium',
  };

  return (
    <header className="flex-none h-14 glass border-b border-[var(--glass-border)] z-50 flex items-center justify-between px-5 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-5">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-violet flex items-center justify-center text-white shadow-sm glow-sm">
            <Sparkles size={13} />
          </div>
          <span className="font-bold text-[15px] tracking-tight hidden sm:block">
            Career<span className="text-gradient">Forge</span>
          </span>
        </Link>

        {/* Nav pills — only show if logged in */}
        {user && (
          <nav className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-xl border border-border/60">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  }`}>
                  {active && (
                    <div className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50" />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {item.icon}
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {/* Plan badge */}
            {user.subscription_plan !== 'basic' && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Crown size={11} style={{ color: 'var(--violet)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--violet)' }}>
                  {planBadge[user.subscription_plan]}
                </span>
              </div>
            )}
            {/* User avatar */}
            <button onClick={() => navigate('/dashboard')}
              className="w-8 h-8 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[12px] font-bold border border-violet-500/20">
              {user.full_name?.charAt(0)?.toUpperCase() || <User size={14} />}
            </button>
            {/* Logout */}
            <button onClick={() => { logout(); navigate('/'); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <Link to="/login"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-violet text-white text-[13px] font-semibold shadow-sm hover:opacity-90 transition-opacity">
            <LogIn size={13} /> Sign in
          </Link>
        )}
        {/* Theme toggle */}
        <button onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>
    </header>
  );
};