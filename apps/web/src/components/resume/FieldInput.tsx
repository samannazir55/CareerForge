import { type ChangeEvent } from 'react';
import type { FieldDef } from '@careerforge/schema';
import { Input } from '../ui/Input';

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * The heart of "templates/forms automatically handle custom sections": this
 * component never knows or cares whether `field` belongs to a built-in
 * section or a user-invented custom one — it only switches on `field.kind`.
 */
export function FieldInput({ field, value, onChange }: FieldInputProps) {
  const stringValue = typeof value === 'string' ? value : '';

  switch (field.kind) {
    case 'richtext':
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{field.label}</label>
          <textarea
            value={stringValue}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      );

    case 'date':
      return (
        <Input
          label={field.label}
          type="month"
          value={stringValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      );

    case 'url':
      return (
        <Input
          label={field.label}
          type="url"
          placeholder="https://"
          value={stringValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      );

    case 'list': {
      // Stored as string[]; edited as comma-separated for simplicity.
      const listValue = Array.isArray(value) ? value.join(', ') : stringValue;
      return (
        <Input
          label={field.label}
          value={listValue}
          placeholder="Comma-separated"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(
              e.target.value
                .split(',')
                .map((v: string) => v.trim())
                .filter(Boolean),
            )
          }
        />
      );
    }

    case 'text':
    default:
      return (
        <Input
          label={field.label}
          value={stringValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      );
  }
}
