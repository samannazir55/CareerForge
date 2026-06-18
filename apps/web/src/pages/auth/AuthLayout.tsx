import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../../components/ui/GlassCard';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared shell for every auth screen (login, register, OTP, forgot/reset
 * password) so the gradient backdrop and card entrance animation are defined
 * once, not re-typed on each page. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-ai flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gradient inline-block">CareerForge</h1>
        </div>
        <GlassCard>
          <h2 className="text-xl font-semibold mb-1">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </GlassCard>
      </motion.div>
    </div>
  );
}
