import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Thin wrapper around the design system's .glass-panel utility, so every
 * card-like surface in the app shares one definition of "what glass looks
 * like" instead of each page re-typing the utility class string. */
export function GlassCard({ className, children, ...props }: GlassCardProps) {
  return (
    <div className={cn('glass-panel rounded-2xl p-6 sm:p-8', className)} {...props}>
      {children}
    </div>
  );
}
