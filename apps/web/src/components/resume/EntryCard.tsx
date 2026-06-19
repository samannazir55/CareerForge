import type { Entry, FieldDef } from '@careerforge/schema';
import { X } from 'lucide-react';
import { FieldInput } from './FieldInput';

interface EntryCardProps {
  entry: Entry;
  fields: FieldDef[];
  onChangeField: (key: string, value: unknown) => void;
  onRemove: () => void;
}

export function EntryCard({ entry, fields, onChangeField, onRemove }: EntryCardProps) {
  return (
    <div className="rounded-xl border border-border p-4 relative grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove entry"
        className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
      >
        <X size={16} />
      </button>
      {fields.map((field) => (
        <div key={field.key} className={field.kind === 'richtext' ? 'sm:col-span-2' : ''}>
          <FieldInput
            field={field}
            value={entry.values[field.key]}
            onChange={(value) => onChangeField(field.key, value)}
          />
        </div>
      ))}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground sm:col-span-2">This section has no fields yet — add one below.</p>
      )}
    </div>
  );
}
