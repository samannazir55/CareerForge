import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, History, Download } from 'lucide-react';
import type { Resume, Section, SectionType } from '@careerforge/schema';
import { createSection, createCustomSection, addSection, reorderSections } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { useAutosave } from '../../hooks/useAutosave';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/resume/SectionCard';
import { ResumePreview } from '../../components/preview/ResumePreview';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionTypeToAdd, setSectionTypeToAdd] = useState<string>('experience');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionSaved, setVersionSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    resumeApi
      .get(id)
      .then((data) => {
        setResume(data.resume);
        setTitle(data.resume.title);
        setSections(data.resume.sections);
      })
      .catch(() => setLoadError('Could not load this resume — it may not exist, or may not belong to you.'));
  }, [id]);

  const autosaveStatus = useAutosave(
    { title, sections },
    async (value) => {
      if (!id) return;
      await resumeApi.update(id, { title: value.title, sections: value.sections });
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

  async function handleSaveVersion() {
    if (!id) return;
    setIsSavingVersion(true);
    try {
      // Flush the latest edits before snapshotting, so the version reflects
      // what's on screen right now rather than whatever autosave last sent.
      await resumeApi.update(id, { title, sections });
      await resumeApi.createVersion(id);
      setVersionSaved(true);
      setTimeout(() => setVersionSaved(false), 2000);
    } finally {
      setIsSavingVersion(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-destructive">{loadError}</p>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 sm:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/resumes" className="text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <input
            value={title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 min-w-0 flex-1"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AutosaveIndicator status={autosaveStatus} />
          <Button variant="ghost" size="sm" onClick={() => navigate(`/resumes/${id}/versions`)}>
            <History size={14} className="mr-1.5" /> History
          </Button>
          <Button size="sm" onClick={handleSaveVersion} disabled={isSavingVersion}>
            {versionSaved ? 'Saved ✓' : isSavingVersion ? 'Saving…' : 'Save version'}
          </Button>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left: editor */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            {sections
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((section, i) => (
                <SectionCard
                  key={section.id}
                  sections={sections}
                  sectionId={section.id}
                  onSectionsChange={setSections}
                  onMove={handleMoveSection}
                  isFirst={i === 0}
                  isLast={i === sections.length - 1}
                />
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

        {/* Right: live preview + export buttons (hidden on small screens) */}
        <div className="hidden lg:flex flex-col items-center gap-4 p-6 bg-muted/30 border-l border-border overflow-y-auto">
          <div className="flex gap-2 self-end">
            <a
              href={`/api/resumes/${id}/export/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download size={14} /> PDF
            </a>
            <a
              href={`/api/resumes/${id}/export/docx`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download size={14} /> DOCX
            </a>
          </div>
          {resume && (
            <ResumePreview
              resume={{ ...resume, title, sections }}
              scale={0.48}
            />
          )}
        </div>
      </div>
    </div>
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
