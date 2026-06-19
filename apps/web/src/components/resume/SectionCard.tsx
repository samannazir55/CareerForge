import { useState, type ChangeEvent } from 'react';
import type { Section } from '@careerforge/schema';
import { addEntry, removeEntry, updateEntry, removeSection, renameSection, addCustomField } from '@careerforge/schema';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { EntryCard } from './EntryCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface SectionCardProps {
  sections: Section[];
  sectionId: string;
  onSectionsChange: (sections: Section[]) => void;
  onMove: (sectionId: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * Every mutation here goes through the pure helpers in
 * @careerforge/schema (packages/schema/src/sectionOperations.ts) rather than
 * hand-rolled array surgery in this component — the same functions a future
 * second consumer (e.g. an AI-chat-driven editor) would use, so "what does
 * adding an entry mean" has exactly one definition.
 */
export function SectionCard({ sections, sectionId, onSectionsChange, onMove, isFirst, isLast }: SectionCardProps) {
  const section = sections.find((s) => s.id === sectionId);
  const [newFieldLabel, setNewFieldLabel] = useState('');

  if (!section) return null;

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <input
          value={section.title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSectionsChange(renameSection(sections, sectionId, e.target.value))}
          className="text-lg font-semibold bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 -ml-1"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMove(sectionId, 'up')}
            className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"
            aria-label="Move section up"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMove(sectionId, 'down')}
            className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30"
            aria-label="Move section down"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            onClick={() => onSectionsChange(removeSection(sections, sectionId))}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive"
            aria-label="Remove section"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {section.entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            fields={section.fields}
            onChangeField={(key, value) => onSectionsChange(updateEntry(sections, sectionId, entry.id, { [key]: value }))}
            onRemove={() => onSectionsChange(removeEntry(sections, sectionId, entry.id))}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => onSectionsChange(addEntry(sections, sectionId))}
      >
        <Plus size={14} className="mr-1.5" /> Add entry
      </Button>

      {section.type === 'custom' && (
        <div className="flex items-end gap-2 mt-4 pt-4 border-t border-border">
          <Input
            label="Add a field to this section"
            placeholder="e.g. Patent Number"
            value={newFieldLabel}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewFieldLabel(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!newFieldLabel.trim()}
            onClick={() => {
              const key = newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_');
              onSectionsChange(addCustomField(sections, sectionId, { key, label: newFieldLabel.trim(), kind: 'text' }));
              setNewFieldLabel('');
            }}
          >
            Add field
          </Button>
        </div>
      )}
    </div>
  );
}
