import { useId, type ChangeEvent } from 'react';

// Curated presets shown as quick-pick swatches. The native color input next
// to them covers "every possible color" (any hex value, full spectrum) —
// these are just a fast path to good-looking values without having to know
// hex codes.
const PRESET_COLORS = [
  '#4f46e5', // indigo (default)
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0891b2', // cyan
  '#0d9488', // teal
  '#16a34a', // green
  '#65a30d', // lime
  '#d97706', // amber
  '#ea580c', // orange
  '#dc2626', // red
  '#db2777', // pink
  '#475569', // slate
];

interface AccentColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  /** Dynamic (admin-created) templates don't read theme.accentColor at all —
   * pass true to grey the control out with an explanatory title rather than
   * offering a control that silently has no visual effect. */
  disabled?: boolean;
  className?: string;
}

export function AccentColorPicker({ value, onChange, disabled, className = '' }: AccentColorPickerProps) {
  const inputId = useId();

  function handleNativeChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div
      className={`flex items-center gap-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
      title={disabled ? "This template has its own fixed palette — accent color only applies to Modern/Classic." : undefined}
    >
      <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-1 py-1">
        {PRESET_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`Set accent color ${hex}`}
            aria-pressed={value.toLowerCase() === hex}
            disabled={disabled}
            onClick={() => onChange(hex)}
            className={`h-5 w-5 rounded-full shrink-0 transition-transform hover:scale-110 ${
              value.toLowerCase() === hex ? 'ring-2 ring-offset-1 ring-offset-background ring-foreground/70' : ''
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

      {/* Native color input — gives access to the full spectrum, not just
          the presets above. The visible swatch is styled; the actual
          <input type="color"> is just made large and transparent on top of
          it so the OS color picker still opens on click. */}
      <label
        htmlFor={inputId}
        className="relative h-7 w-7 rounded-full border border-input shrink-0 cursor-pointer overflow-hidden"
        style={{ backgroundColor: value }}
        title="Pick any color"
      >
        <input
          id={inputId}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#4f46e5'}
          onChange={handleNativeChange}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide hidden sm:inline">
        {value}
      </span>
    </div>
  );
}