import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogoMark } from './LogoMark';

interface BrandLoaderProps {
  /**
   * 0-100. Omit this for loads with no real progress signal (auth checks,
   * route transitions) — the loader then runs its own decelerating ramp
   * that eases up to ~92% and holds, rather than claiming false completion.
   * Pass a real number (e.g. upload/export progress) to switch to
   * controlled mode.
   */
  progress?: number;
  label?: string;
  size?: number;
  className?: string;
}

export function BrandLoader({ progress, label = 'Loading', size = 96, className }: BrandLoaderProps) {
  const [simulated, setSimulated] = useState(0);
  const controlled = progress !== undefined;

  useEffect(() => {
    if (controlled) return;
    let raf: number;
    let start: number | null = null;
    function tick(t: number) {
      if (start === null) start = t;
      const elapsed = t - start;
      // Decelerating ease toward 92% — never implies "done" on its own;
      // the parent unmounts this once the real thing actually finishes.
      setSimulated(92 * (1 - Math.exp(-elapsed / 900)));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlled]);

  const pct = Math.round(controlled ? Math.max(0, Math.min(100, progress!)) : simulated);
  const stroke = 4;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={className ? `flex flex-col items-center gap-4 ${className}` : 'flex flex-col items-center gap-4'} role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            <linearGradient id="brand-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#brand-loader-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
          <LogoMark size={size * 0.36} animate />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{pct}%</p>
      </div>
    </div>
  );
}
