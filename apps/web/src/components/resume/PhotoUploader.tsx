import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, User } from 'lucide-react';
import { resumeApi, ApiError } from '../../lib/api';

interface PhotoUploaderProps {
  resumeId: string;
  value: string | undefined;
  onChange: (photoUrl: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024; // keep in sync with cloudinary.service.ts

/**
 * Upload/remove control for a resume's profile photo (theme.photoUrl).
 * Unlike AccentColorPicker, this can't be a pure controlled value/onChange
 * component — the actual upload is an async network call with its own
 * loading/error states — so it owns that request itself and calls
 * onChange(url) once Cloudinary has actually returned one, same end result
 * (parent's theme state updates, autosave picks it up) via a different path.
 */
export function PhotoUploader({ resumeId, value, onChange, disabled, className = '' }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setStatus('error');
      setError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus('error');
      setError(`Photo is too large (max ${MAX_BYTES / 1024 / 1024}MB).`);
      return;
    }

    setStatus('uploading');
    setError(null);
    try {
      const { resume } = await resumeApi.uploadPhoto(resumeId, file);
      onChange(resume.theme.photoUrl);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Upload failed — try again.');
    }
  }

  async function handleRemove() {
    setStatus('uploading'); // reuse the same spinner state for "busy"
    setError(null);
    try {
      const { resume } = await resumeApi.deletePhoto(resumeId);
      onChange(resume.theme.photoUrl);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Couldn\u2019t remove photo — try again.');
    }
  }

  const busy = disabled || status === 'uploading';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-9 w-9 rounded-full border border-input bg-muted shrink-0 overflow-hidden flex items-center justify-center">
        {status === 'uploading' ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelected}
        disabled={busy}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {value ? 'Replace photo' : 'Add photo'}
      </button>

      {value && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          aria-label="Remove photo"
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50 disabled:pointer-events-none"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
