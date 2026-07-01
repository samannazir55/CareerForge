import { motion } from 'framer-motion';

interface SuggestionCapsulesProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

/**
 * Tappable suggested-reply pills shown below the latest AI message,
 * ported from the Magic Patterns ChatPanel's `quickReplies` pattern.
 * The original was driven by a hardcoded conversation script
 * (ScriptStep.quickReplies); since this app's chat is genuinely
 * AI-driven, suggestions instead come from the model itself via a
 * SUGGESTIONS: marker in its response (see ai.routes.ts system prompt
 * and the adapters' extractChatMarkers()), making them contextual to
 * whatever the AI actually just asked rather than a fixed script.
 */
export function SuggestionCapsules({ suggestions, onSelect, disabled }: SuggestionCapsulesProps) {
  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-wrap gap-2 px-4 pt-3"
    >
      {suggestions.map((suggestion, idx) => (
        <button
          key={`${suggestion}-${idx}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(suggestion)}
          className="text-sm px-4 py-2 rounded-full border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          {suggestion}
        </button>
      ))}
    </motion.div>
  );
}
