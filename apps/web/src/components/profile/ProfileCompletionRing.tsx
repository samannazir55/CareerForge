import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ProfileCompletionRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProfileCompletionRing({
  score,
  size = 80,
  strokeWidth = 6,
  className,
  showLabel = true,
}: ProfileCompletionRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = useMemo(() => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  }, [score]);

  const strokeColor = useMemo(() => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#f43f5e';
  }, [score]);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-bold tabular-nums', color)}>{score}%</span>
        </div>
      )}
    </div>
  );
}
