import { useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Generic debounced-autosave hook — "auto-save throughout the application"
 * is a stated requirement, not a one-off feature of the resume editor, so
 * this is written to be reusable wherever else autosave is needed later
 * (cover letters, profile settings, etc.), not resume-specific.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 1200) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const isFirstRender = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return; // never autosave the initial load — only actual edits
    }

    setStatus('idle');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await save(latestValueRef.current);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, delayMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return status;
}
