import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-foreground">{label}</label>
      )}
      <input
        className={cn(
          'w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent',
          'transition-all',
          error && 'border-destructive focus:ring-destructive/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold text-foreground">{label}</label>
      )}
      <textarea
        className={cn(
          'w-full px-3 py-2.5 rounded-xl border border-border bg-card text-foreground',
          'placeholder:text-muted-foreground resize-none',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent',
          'transition-all',
          error && 'border-destructive focus:ring-destructive/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
