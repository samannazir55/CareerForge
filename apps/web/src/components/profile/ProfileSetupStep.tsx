import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ProfileSetupStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
}

export function ProfileSetupStep({
  stepNumber,
  totalSteps,
  title,
  description,
  isCompleted,
  isActive,
}: ProfileSetupStepProps) {
  return (
    <div className={cn('flex items-start gap-4 p-4', isActive && 'opacity-100', !isActive && !isCompleted && 'opacity-40')}>
      {/* Step indicator */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors"
        style={{
          borderColor: isCompleted ? '#10b981' : isActive ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          background: isCompleted ? '#10b981' : 'transparent',
          color: isCompleted ? 'white' : 'inherit',
        }}
      >
        {isCompleted ? <Check size={14} /> : stepNumber}
      </div>

      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>

      <div className="ml-auto text-xs text-muted-foreground">
        {stepNumber} of {totalSteps}
      </div>
    </div>
  );
}