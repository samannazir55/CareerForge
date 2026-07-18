import { cn } from '../../lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/** Small controlled toggle switch. Styled by hand (rather than a checkbox
 * input) since the design system has no existing switch component — see
 * ThemeToggle.tsx for the closest prior art, which is a plain icon button
 * rather than a two-state track/thumb control like this one. */
export function Switch({ checked, onChange, disabled, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        // bg-input resolves via the --input CSS var, which is defined for
        // both the light (:root) and dark (.dark) themes — a fixed
        // bg-white/10 here would be nearly invisible against the light
        // theme's near-white background.
        checked ? 'bg-indigo-500' : 'bg-input',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-1',
        )}
      />
    </button>
  );
}
