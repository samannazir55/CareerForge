import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, History, Download, FileType2, Sparkles, Lock } from 'lucide-react';
import type { Resume, ResumeTheme, Section, SectionType } from '@careerforge/schema';
import { createSection, createCustomSection, addSection, reorderSections, isDynamicTemplateId, DEFAULT_THEME, updateEntry, removeEntry, removeSection } from '@careerforge/schema';
import { resumeApi, ApiError } from '../../lib/api';
import { useAutosave } from '../../hooks/useAutosave';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/resume/SectionCard';
import { ResumePreview, type ResumePreviewEditEvent } from '../../components/preview/ResumePreview';
import { TemplateSwitcher } from '../../components/resume/TemplateSwitcher';
import { AccentColorPicker } from '../../components/resume/AccentColorPicker';
import { PhotoUploader } from '../../components/resume/PhotoUploader';
import { AppShell } from '../../components/layout/AppShell';

const ADDABLE_SECTION_TYPES: Array<{ value: Exclude<SectionType, 'custom'> | 'custom'; label: string }> = [
  { value: 'experience', label: 'Experience' },
  { value: 'education', label: 'Education' },
  { value: 'skills', label: 'Skills' },
  { value: 'certifications', label: 'Certifications' },
  { value: 'projects', label: 'Projects' },
  { value: 'languages', label: 'Languages' },
  { value: 'references', label: 'References' },
  { value: 'custom', label: 'Custom section…' },
];

export function ResumeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [resume, setResume] = useState<Resume | null>(null);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [theme, setTheme] = useState<ResumeTheme>(DEFAULT_THEME);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionTypeToAdd, setSectionTypeToAdd] = useState<string>('experience');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionSaved, setVersionSaved] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [exportError, setExportError] = useState<{ message: string; premiumRequired: boolean } | null>(null);
  // The live preview + export buttons below are only reachable on mobile —
  // the desktop side-by-side panel (further down) is `hidden` below the
  // `lg` breakpoint, which previously left mobile with no preview and no
  // download option at all.
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const mobilePreviewContainerRef = useRef<HTMLDivElement>(null);
  const [mobilePreviewScale, setMobilePreviewScale] = useState(0.5);

  useEffect(() => {
    const el = mobilePreviewContainerRef.current;
    if (!el || !mobilePreviewOpen) return;
    const A4_WIDTH_PX = 794;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setMobilePreviewScale(Math.min(1, Math.max(0.25, (width - 16) / A4_WIDTH_PX)));
    };
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [mobilePreviewOpen]);

  useEffect(() => {
    if (!id) return;
    resumeApi
      .get(id)
      .then((data) => {
        setResume(data.resume);
        setTitle(data.resume.title);
        setSections(data.resume.sections);
        setTheme(data.resume.theme);
      })
      .catch(() => setLoadError('Could not load this resume — it may not exist, or may not belong to you.'));
  }, [id]);

  const autosaveStatus = useAutosave(
    { title, sections, theme },
    async (value) => {
      if (!id) return;
      await resumeApi.update(id, { title: value.title, sections: value.sections, theme: value.theme });
    },
  );

  function handleAddSection() {
    const order = sections.length;
    const newSection =
      sectionTypeToAdd === 'custom'
        ? createCustomSection('New Section', order)
        : createSection(sectionTypeToAdd as Exclude<SectionType, 'custom'>, sectionLabelFor(sectionTypeToAdd), order);
    setSections(addSection(sections, newSection));
  }

  function handleMoveSection(sectionId: string, direction: 'up' | 'down') {
    const index = sections.findIndex((s) => s.id === sectionId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const ids = sections.map((s) => s.id);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    setSections(reorderSections(sections, ids));
  }

  function handleTemplateSelect(templateId: string) {
    setTheme((t) => ({ ...t, templateId }));
  }

  function handleAccentColorChange(accentColor: string) {
    setTheme((t) => ({ ...t, accentColor }));
  }

  function handlePhotoChange(photoUrl: string | undefined) {
    setTheme((t) => ({ ...t, photoUrl }));
  }

  // The resume's full name (title) is the one editable field that isn't
  // stored in any section/entry (see CF_TITLE_* in dynamicTemplateRenderer.ts
  // and packages/templates/src/helpers.ts) — the preview's inline-editing
  // bootstrap uses this sentinel section/entry id pair to flag it as a
  // special case rather than a real entry to look up.
  const CF_TITLE_SECTION_ID = '__title__';

  /** Routes edits/deletes made directly on the interactive preview (see
   * ResumePreview's `interactive` prop) through the exact same pure
   * section-mutation helpers the left-hand form uses (SectionCard.tsx) —
   * "what does editing a field / deleting an entry mean" has one
   * definition regardless of which UI triggered it. */
  function handlePreviewEdit(event: ResumePreviewEditEvent) {
    if (event.type === 'field-edit' && event.sectionId === CF_TITLE_SECTION_ID) {
      setTitle(event.value);
      return;
    }
    if (event.type === 'field-edit') {
      setSections((s) => updateEntry(s, event.sectionId, event.entryId, { [event.field]: event.value }));
    } else if (event.type === 'delete-entry') {
      setSections((s) => removeEntry(s, event.sectionId, event.entryId));
    } else if (event.type === 'delete-section') {
      setSections((s) => removeSection(s, event.sectionId));
    }
  }

  async function handleSaveVersion() {
    if (!id) return;
    setIsSavingVersion(true);
    try {
      await resumeApi.update(id, { title, sections });
      await resumeApi.createVersion(id);
      setVersionSaved(true);
      setTimeout(() => setVersionSaved(false), 2000);
    } finally {
      setIsSavingVersion(false);
    }
  }

  // Dynamic (admin-created) templates are arbitrary AI-generated HTML/CSS
  // with no reliable generic mapping to OOXML — export.service.ts rejects a
  // DOCX request for one with a 400 (DOCX_NOT_SUPPORTED_DYNAMIC). Hiding the
  // button here avoids sending a request that's guaranteed to fail. Reads
  // from the live `theme` state (not the last-loaded `resume.theme`) so it
  // updates immediately when the template switcher below is used.
  const isDynamicTemplate = isDynamicTemplateId(theme.templateId ?? 'modern');

  async function handleExport(format: 'pdf' | 'docx') {
    if (!id) return;
    setExporting(format);
    setExportError(null);
    try {
      const { blob, filename } = await resumeApi.export(id, format);
      // Deliberately not a plain <a href={...}> — that approach can't react
      // to a non-2xx response at all, so a premium-gated template used to
      // just open a blank tab containing raw JSON with no explanation.
      // Fetching directly and building a blob URL lets us catch that case
      // (see the ApiError branch below) while still triggering a normal
      // browser download for the success case.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename ?? `resume.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PREMIUM_REQUIRED') {
        setExportError({ message: err.message, premiumRequired: true });
      } else {
        setExportError({
          message: err instanceof ApiError ? err.message : 'Could not export your resume. Please try again.',
          premiumRequired: false,
        });
      }
    } finally {
      setExporting(null);
    }
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <p className="text-destructive">{loadError}</p>
        </div>
      </AppShell>
    );
  }

  if (!resume) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Contextual editor bar */}
        <div className="glass-panel border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-indigo-400" />
            </div>
            <input
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 min-w-0 flex-1"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AutosaveIndicator status={autosaveStatus} />
            <Button variant="ghost" size="sm" onClick={() => navigate(`/resumes/${id}/chat`)}>
              <Sparkles size={14} className="mr-1.5" /> Back to chat
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/resumes/${id}/versions`)}>
              <History size={14} className="mr-1.5" /> History
            </Button>
            <Button
              size="sm"
              onClick={handleSaveVersion}
              disabled={isSavingVersion}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-500/90 hover:to-purple-600/90 shadow-lg shadow-indigo-500/20"
            >
              {versionSaved ? 'Saved ✓' : isSavingVersion ? 'Saving…' : 'Save version'}
            </Button>
          </div>
        </div>

        {/* Two-pane layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: editor */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-xl mx-auto flex flex-col gap-4">
              {/* Mobile-only preview & export — the side-by-side panel further
                  down is `hidden` below the `lg` breakpoint, so this is the
                  only way to preview or download the resume on mobile.
                  Placed first so it's the first thing a mobile user sees,
                  before they scroll down to the editing sections. */}
              <div className="lg:hidden rounded-xl border border-border bg-gradient-to-b from-indigo-500/[0.03] to-transparent">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setMobilePreviewOpen((open) => !open)}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    {mobilePreviewOpen ? 'Hide preview' : 'Show preview'}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      disabled={exporting !== null}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-60"
                    >
                      <Download size={14} /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
                    </button>
                    {!isDynamicTemplate && (
                      <button
                        type="button"
                        onClick={() => handleExport('docx')}
                        disabled={exporting !== null}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-60"
                      >
                        <FileType2 size={14} /> {exporting === 'docx' ? 'Exporting…' : 'DOCX'}
                      </button>
                    )}
                  </div>
                </div>
                {exportError && (
                  <div className="px-4 pb-3 text-xs">
                    <p className={exportError.premiumRequired ? 'text-amber-400' : 'text-destructive'}>
                      {exportError.premiumRequired && <Lock size={11} className="inline mr-1 -mt-0.5" />}
                      {exportError.message}
                    </p>
                    {exportError.premiumRequired && (
                      <Link to="/settings/subscription" className="underline text-amber-300 hover:text-amber-200">
                        Upgrade your plan
                      </Link>
                    )}
                  </div>
                )}
                {mobilePreviewOpen && (
                  <>
                    <div className="px-4 pb-3 space-y-3">
                      <TemplateSwitcher currentTemplateId={theme.templateId} onSelect={handleTemplateSelect} />
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accent Color</p>
                        <AccentColorPicker value={theme.accentColor} onChange={handleAccentColorChange} />
                      </div>
                      {id && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photo</p>
                          <PhotoUploader resumeId={id} value={theme.photoUrl} onChange={handlePhotoChange} />
                        </div>
                      )}
                    </div>
                    <div ref={mobilePreviewContainerRef} className="flex justify-center px-4 pb-4">
                      {resume && (
                        <ResumePreview
                          resume={{ ...resume, title, sections, theme }}
                          scale={mobilePreviewScale}
                          className="ring-1 ring-white/10 shadow-2xl shadow-indigo-500/10"
                          interactive
                          onEdit={handlePreviewEdit}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((section, i) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SectionCard
                      sections={sections}
                      sectionId={section.id}
                      onSectionsChange={setSections}
                      onMove={handleMoveSection}
                      isFirst={i === 0}
                      isLast={i === sections.length - 1}
                    />
                  </motion.div>
                ))}

              <div className="flex items-end gap-2 mt-2">
                <select
                  value={sectionTypeToAdd}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSectionTypeToAdd(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {ADDABLE_SECTION_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" onClick={handleAddSection}>
                  <Plus size={16} className="mr-1.5" /> Add section
                </Button>
              </div>
            </div>
          </div>

          {/* Right: live preview + export buttons */}
          <div className="hidden lg:flex flex-col items-center gap-4 p-6 bg-gradient-to-b from-indigo-500/[0.03] to-transparent border-l border-border overflow-y-auto">
            <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background/50 p-4">
              <TemplateSwitcher currentTemplateId={theme.templateId} onSelect={handleTemplateSelect} />
              <div className="border-t border-border" />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accent Color</p>
                <AccentColorPicker value={theme.accentColor} onChange={handleAccentColorChange} />
              </div>
              {id && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photo</p>
                  <PhotoUploader resumeId={id} value={theme.photoUrl} onChange={handlePhotoChange} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 self-end items-end">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting !== null}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-60"
                >
                  <Download size={14} /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
                </button>
                {!isDynamicTemplate && (
                  <button
                    type="button"
                    onClick={() => handleExport('docx')}
                    disabled={exporting !== null}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-60"
                  >
                    <FileType2 size={14} /> {exporting === 'docx' ? 'Exporting…' : 'DOCX'}
                  </button>
                )}
              </div>
              {exportError && (
                <div className="text-xs text-right max-w-[220px]">
                  <p className={exportError.premiumRequired ? 'text-amber-400' : 'text-destructive'}>
                    {exportError.premiumRequired && <Lock size={11} className="inline mr-1 -mt-0.5" />}
                    {exportError.message}
                  </p>
                  {exportError.premiumRequired && (
                    <Link to="/settings/subscription" className="underline text-amber-300 hover:text-amber-200">
                      Upgrade your plan
                    </Link>
                  )}
                </div>
              )}
            </div>
            {resume && (
              <ResumePreview
                resume={{ ...resume, title, sections, theme }}
                scale={0.48}
                className="ring-1 ring-white/10 shadow-2xl shadow-indigo-500/10"
                interactive
                onEdit={handlePreviewEdit}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function sectionLabelFor(type: string): string {
  const match = ADDABLE_SECTION_TYPES.find((s) => s.value === type);
  return match?.label ?? 'Section';
}

function AutosaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const text = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[status];
  if (!text) return <span className="w-16" />;
  return (
    <span className={`text-xs whitespace-nowrap ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
      {text}
    </span>
  );
}