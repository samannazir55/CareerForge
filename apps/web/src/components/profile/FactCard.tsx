import { useState } from 'react';
import { Pencil, Trash2, Check, X, ShieldCheck, Brain, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import type { ProfileFact, FactSource } from '@careerforge/schema';

interface FactCardProps {
  fact: ProfileFact;
  onEdit?: (fact: ProfileFact) => void;
  onDelete?: (key: string) => void;
  className?: string;
}

const SOURCE_META: Record<FactSource, { icon: React.ReactNode; label: string; color: string }> = {
  USER_CONFIRMED: {
    icon: <ShieldCheck size={12} />,
    label: 'Confirmed',
    color: 'text-emerald-500',
  },
  AI_EXTRACTED: {
    icon: <Brain size={12} />,
    label: 'AI extracted',
    color: 'text-blue-500',
  },
  AI_INFERRED: {
    icon: <Brain size={12} />,
    label: 'AI inferred',
    color: 'text-purple-500',
  },
  SYSTEM_GENERATED: {
    icon: <User size={12} />,
    label: 'Auto-filled',
    color: 'text-muted-foreground',
  },
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(' · ');
  }
  return JSON.stringify(value);
}

export function FactCard({ fact, onEdit, onDelete, className }: FactCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const sourceMeta = SOURCE_META[fact.source];

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDelete?.(fact.key);
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'glass-panel rounded-2xl p-4 flex items-start gap-3 group',
        className,
      )}
    >
      <div
        className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background:
            fact.confidenceScore >= 80
              ? '#10b981'
              : fact.confidenceScore >= 50
              ? '#f59e0b'
              : '#f43f5e',
        }}
        title={`Confidence: ${fact.confidenceScore}%`}
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-mono truncate mb-0.5">{fact.key}</p>
        <p className="text-sm text-foreground leading-snug break-words">
          {formatValue(fact.value)}
        </p>
        <div className={cn('flex items-center gap-1 mt-1.5', sourceMeta.color)}>
          {sourceMeta.icon}
          <span className="text-xs">{sourceMeta.label}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(fact)}
            aria-label="Edit fact"
          >
            <Pencil size={13} />
          </Button>
        )}
        {onDelete && (
          <AnimatePresence mode="wait">
            {confirmingDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteClick}
                  aria-label="Confirm delete"
                >
                  <Check size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setConfirmingDelete(false)}
                  aria-label="Cancel"
                >
                  <X size={13} />
                </Button>
              </motion.div>
            ) : (
              <motion.div key="delete" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={handleDeleteClick}
                  aria-label="Delete fact"
                >
                  <Trash2 size={13} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
