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

    case 'date': {
      // The native <input type="month"> only accepts a real yyyy-MM value
      // (4-digit year that isn't "0000", month 01–12) — anything else
      // (e.g. a stray "0000-01" that ended up in stored data) makes Chrome
      // log a console warning on every render without actually displaying
      // it. Falling back to '' here means bad existing data shows as an
      // empty field instead of spamming the console; the user can just
      // re-enter the date if the field looks unexpectedly blank.
      const monthValue = /^\d{4}-(0[1-9]|1[0-2])$/.test(stringValue) && !stringValue.startsWith('0000')
        ? stringValue
        : '';
      return (
        <Input
          label={field.label}
          type="month"
          value={monthValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      );
    }

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
