import { useEffect, useRef, useState } from 'react';
import { Globe2, Check, X, Loader2, Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import {
  fetchOwnPublicProfileSettings,
  updatePublicProfileSettings,
  fetchPublicProfile,
} from '../../lib/profileApi';
import { ApiError } from '../../lib/api';
import type { CareerProfileWithPublicFields, UpdatePublicProfileSettingsRequest } from '@careerforge/schema';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_DEBOUNCE_MS = 500;
const AUTOSAVE_BANNER_MS = 2000;

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const TEXT_FIELDS: Array<{
  key: 'headline' | 'bio' | 'location' | 'website' | 'linkedinUrl' | 'githubUrl' | 'twitterUrl';
  label: string;
  placeholder: string;
  multiline?: boolean;
}> = [
  { key: 'headline', label: 'Headline', placeholder: 'Senior Software Engineer at Google' },
  { key: 'bio', label: 'Bio', placeholder: 'A short paragraph about your career story…', multiline: true },
  { key: 'location', label: 'Location', placeholder: 'San Francisco, CA' },
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/you' },
  { key: 'githubUrl', label: 'GitHub URL', placeholder: 'https://github.com/you' },
  { key: 'twitterUrl', label: 'Twitter URL', placeholder: 'https://x.com/you' },
];

/**
 * "Your Public Portfolio" section at the top of the Career Profile page.
 * All text fields auto-save on blur (not on every keystroke — see the
 * `onBlur` handlers below); the public toggle saves immediately since
 * it's a single discrete action rather than freeform text.
 */
export function PublicPortfolioSettings() {
  const [settings, setSettings] = useState<CareerProfileWithPublicFields | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [slugInput, setSlugInput] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const slugCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchOwnPublicProfileSettings()
      .then((data) => {
        setSettings(data);
        setSlugInput(data.publicSlug ?? '');
        setFormValues({
          headline: data.headline ?? '',
          bio: data.bio ?? '',
          location: data.location ?? '',
          website: data.website ?? '',
          linkedinUrl: data.linkedinUrl ?? '',
          githubUrl: data.githubUrl ?? '',
          twitterUrl: data.twitterUrl ?? '',
        });
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));

    return () => {
      if (slugCheckTimeoutRef.current) clearTimeout(slugCheckTimeoutRef.current);
      if (savedBannerTimeoutRef.current) clearTimeout(savedBannerTimeoutRef.current);
    };
  }, []);

  function flashSaved() {
    setSaveStatus('saved');
    setSaveError(null);
    if (savedBannerTimeoutRef.current) clearTimeout(savedBannerTimeoutRef.current);
    savedBannerTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), AUTOSAVE_BANNER_MS);
  }

  async function persist(patch: Partial<UpdatePublicProfileSettingsRequest>) {
    try {
      const updated = await updatePublicProfileSettings(patch);
      setSettings(updated);
      flashSaved();
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save.');
    }
  }

  async function handleTogglePublic(next: boolean) {
    if (!settings) return;
    setSettings({ ...settings, isPublic: next });
    await persist({ isPublic: next });
  }

  function handleSlugChange(value: string) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlugInput(normalized);
    setSlugStatus('idle');

    if (slugCheckTimeoutRef.current) clearTimeout(slugCheckTimeoutRef.current);

    if (!normalized || normalized === settings?.publicSlug) return;
    if (normalized.length < 3 || normalized.length > 30 || !SLUG_REGEX.test(normalized)) {
      setSlugStatus('invalid');
      return;
    }

    slugCheckTimeoutRef.current = setTimeout(async () => {
      setSlugStatus('checking');
      try {
        await fetchPublicProfile(normalized);
        // A profile was found at this slug — someone else has it.
        setSlugStatus('taken');
      } catch (e) {
        // 404 means nothing is published there — treat as available.
        // (Advisory only: see the tradeoff note in profile.service.ts —
        // a slug reserved by someone whose profile is still private will
        // also read as "available" here.)
        setSlugStatus(e instanceof ApiError && e.status === 404 ? 'available' : 'idle');
      }
    }, SLUG_DEBOUNCE_MS);
  }

  async function handleSlugBlur() {
    if (!settings || slugInput === (settings.publicSlug ?? '')) return;
    if (!slugInput || slugStatus === 'invalid') return;
    await persist({ publicSlug: slugInput });
  }

  function handleFieldChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFieldBlur(key: (typeof TEXT_FIELDS)[number]['key']) {
    if (!settings) return;
    const current = formValues[key] ?? '';
    const original = settings[key] ?? '';
    if (current === original) return;
    await persist({ [key]: current } as Partial<UpdatePublicProfileSettingsRequest>);
  }

  function handleCopyLink() {
    if (!settings?.publicSlug) return;
    const url = `${window.location.origin}/u/${settings.publicSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (isLoading) {
    return <div className="glass-panel rounded-3xl p-6 h-40 animate-pulse bg-muted/40" />;
  }
  if (!settings) return null;

  return (
    <div className="glass-panel rounded-3xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Globe2 size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Your Public Portfolio</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              One shareable link with your resumes, highlights, and contact info.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs text-emerald-500 flex items-center gap-1 transition-opacity duration-500 ${
              saveStatus === 'saved' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <CheckCircle2 size={12} /> Saved
          </span>
          <span className="text-sm font-medium">Make my profile public</span>
          <Switch checked={settings.isPublic} onChange={handleTogglePublic} label="Make my profile public" />
        </div>
      </div>

      {saveStatus === 'error' && saveError && (
        <p className="text-sm text-destructive -mt-2">{saveError}</p>
      )}

      {/* Slug */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Your profile URL</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center rounded-xl border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
            <span className="pl-3 pr-1 text-sm text-muted-foreground whitespace-nowrap">corvyx.app/u/</span>
            <input
              value={slugInput}
              onChange={(e) => handleSlugChange(e.target.value)}
              onBlur={handleSlugBlur}
              placeholder="saman-nazir"
              className="flex-1 h-10 bg-transparent px-1 text-sm font-mono focus:outline-none min-w-0"
            />
            <span className="pr-3 flex items-center shrink-0">
              {slugStatus === 'checking' && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              {slugStatus === 'available' && <Check size={14} className="text-emerald-500" />}
              {(slugStatus === 'taken' || slugStatus === 'invalid') && <X size={14} className="text-destructive" />}
            </span>
          </div>
        </div>
        {slugStatus === 'taken' && <p className="text-xs text-destructive mt-1.5">That URL is already taken.</p>}
        {slugStatus === 'invalid' && (
          <p className="text-xs text-destructive mt-1.5">3-30 characters — lowercase letters, numbers, and single hyphens only.</p>
        )}
        {slugStatus === 'available' && <p className="text-xs text-emerald-500 mt-1.5">That URL is available.</p>}
      </div>

      {/* Text fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        {TEXT_FIELDS.map(({ key, label, placeholder, multiline }) => (
          <div key={key} className={multiline ? 'sm:col-span-2' : ''}>
            <label className="text-sm font-medium mb-1.5 block">{label}</label>
            {multiline ? (
              <textarea
                value={formValues[key] ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                onBlur={() => handleFieldBlur(key)}
                placeholder={placeholder}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            ) : (
              <input
                value={formValues[key] ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                onBlur={() => handleFieldBlur(key)}
                placeholder={placeholder}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {settings.publicSlug && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          {settings.isPublic && (
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy size={14} className="mr-1.5" /> {copied ? 'Copied!' : 'Copy profile link'}
            </Button>
          )}
          <a
            href={`/u/${settings.publicSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-400 font-medium"
          >
            Preview my profile <ExternalLink size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
