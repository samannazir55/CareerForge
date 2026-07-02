import { type ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

// ---------------------------------------------------------------------------
// StatCard — metric card with optional trend indicator
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'cyan' | 'gray';
  onClick?: () => void;
}

const ACCENT_COLORS = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-500', glow: 'bg-indigo-500/10' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', glow: 'bg-emerald-500/10' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', glow: 'bg-amber-500/10' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', glow: 'bg-rose-500/10' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', glow: 'bg-purple-500/10' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', glow: 'bg-cyan-500/10' },
  gray: { bg: 'bg-muted', text: 'text-muted-foreground', glow: 'bg-muted' },
};

export function StatCard({ label, value, sub, icon, trend, accent = 'indigo', onClick }: StatCardProps) {
  const colors = ACCENT_COLORS[accent] ?? ACCENT_COLORS.gray;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        'glass-panel rounded-2xl p-5 relative overflow-hidden',
        onClick && 'cursor-pointer',
      )}
    >
      <div className={cn('absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl', colors.glow)} />
      <div className="relative z-10 flex items-start justify-between">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', colors.bg)}>
          <span className={colors.text}>{icon}</span>
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground',
          )}>
            {trend === 'up' ? <ChevronUp size={14} /> : trend === 'down' ? <ChevronDown size={14} /> : null}
          </div>
        )}
      </div>
      <div className="relative z-10 mt-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// PageHeader — WP-style page title + action button row
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminBadge — status/tier badge
// ---------------------------------------------------------------------------

interface AdminBadgeProps {
  children: ReactNode;
  variant?: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray';
}

const BADGE_VARIANTS = {
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  blue: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  gray: 'bg-muted text-muted-foreground border-border',
};

export function AdminBadge({ children, variant = 'gray' }: AdminBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border',
      BADGE_VARIANTS[variant],
    )}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SlideOver — right-side panel for edit forms (WordPress meta-box feel)
// ---------------------------------------------------------------------------

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
}

export function SlideOver({ open, onClose, title, description, children, footer, width = 'md' }: SlideOverProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed right-0 top-0 h-full bg-card border-l border-border shadow-2xl z-50 flex flex-col',
              width === 'md' ? 'w-full sm:w-[440px]' : 'w-full sm:w-[600px]',
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors shrink-0 ml-4"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 border-t border-border p-4 flex justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// AdminTable — dense data table matching WP's list table pattern
// ---------------------------------------------------------------------------

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  width?: string;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function AdminTable<T>({
  columns, rows, rowKey, isLoading, emptyMessage = 'No items found.', onRowClick,
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.sortable && 'cursor-pointer hover:text-foreground select-none',
                    col.width,
                  )}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border/50 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-accent/50',
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchBar — shared search input for list pages
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search…' }: SearchBarProps) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormField — consistent label + input wrapper
// ---------------------------------------------------------------------------

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, required, hint, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}
