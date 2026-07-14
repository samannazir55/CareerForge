import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassCard } from '../../components/ui/GlassCard';
import { FloatingSquares } from '../../components/welcome/FloatingSquares';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared shell for every auth screen (login, register, OTP, forgot/reset
 * password). Deliberately matches the welcome page's dark/neon identity —
 * this is the first real screen most people interact with, so it should
 * feel like a continuation of that impression, not a drop into a plain form. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="auth-page relative w-full flex items-center justify-center p-4 overflow-hidden">
      <FloatingSquares count={10} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-7">
          <Link to="/" className="inline-block">
            <h1 className="text-2xl font-semibold text-gradient neon-glow-text">Corvyx</h1>
          </Link>
        </div>

        <GlassCard className="border-white/10">
          <h2 className="text-xl font-semibold mb-1 text-white">{title}</h2>
          {subtitle && <p className="text-sm text-white/50 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-6" />}
          {children}
        </GlassCard>
      </motion.div>
    </div>
  );
}
