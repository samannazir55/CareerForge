import React from 'react';
import { Sparkles, Coins, LayoutDashboard, Store, PenTool, Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../context/AppStore';
import { Button } from '../ui/Button';

type NavView = 'chat' | 'editor' | 'marketplace' | 'dashboard';

interface TopNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const NAV_ITEMS: Array<{ id: NavView; label: string; icon: React.ReactNode }> = [
  { id: 'chat',        label: 'AI Chat',    icon: <Sparkles size={15} /> },
  { id: 'editor',      label: 'Editor',     icon: <PenTool size={15} /> },
  { id: 'marketplace', label: 'Templates',  icon: <Store size={15} /> },
  { id: 'dashboard',   label: 'Dashboard',  icon: <LayoutDashboard size={15} /> },
];

export function TopNav({ currentView, onNavigate, theme, onToggleTheme }: TopNavProps) {
  const { user, logout } = useAuth();
  const { pointsBalance, subscriptionPlan } = useAppStore();

  return (
    <div className="flex-none h-16 border-b border-border glass-panel z-50 flex items-center justify-between px-4 md:px-6 sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles size={15} />
          </div>
          <span className="font-bold text-lg hidden sm:inline-block tracking-tight">
            CareerForge
          </span>
        </div>

        {/* Nav Pills — active state via CSS only, no framer-motion */}
        <nav className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentView === item.id
                  ? 'bg-background text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        >
          <Coins size={14} className="text-amber-500" />
          <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{pointsBalance}</span>
        </button>

        {subscriptionPlan !== 'basic' && (
          <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
            {subscriptionPlan}
          </div>
        )}

        <span className="hidden lg:block text-sm text-muted-foreground">
          {user?.fullName?.split(' ')[0] || 'User'}
        </span>

        <Button variant="ghost" size="icon" onClick={onToggleTheme} className="rounded-full">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </Button>

        <Button variant="ghost" size="icon" onClick={logout} className="rounded-full" title="Sign out">
          <LogOut size={16} />
        </Button>
      </div>
    </div>
  );
}