import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

// Ported as-is from the Magic Patterns design system — this component was
// already good; the rebuild reuses it directly rather than redesigning it.
interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles =
      'btn-shine-wrap relative overflow-hidden inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
    };
    const sizes = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-11 px-4 py-2',
      lg: 'h-14 px-8 text-lg rounded-2xl',
      icon: 'h-11 w-11',
    };
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.035 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        <span className="btn-shine-sweep" aria-hidden="true" />
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
          {props.children}
        </span>
      </motion.button>
    );
  },
);
Button.displayName = 'Button';