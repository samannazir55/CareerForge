import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, History, Download, FileType2, Sparkles } from 'lucide-react';
import type { Resume, Section, SectionType } from '@careerforge/schema';
import { createSection, createCustomSection, addSection, reorderSections } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { useAutosave } from '../../hooks/useAutosave';
import { Button } from '../../components/ui/Button';
import { SectionCard } from '../../components/resume/SectionCard';
import { ResumePreview } from '../../components/preview/ResumePreview';
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
                <FileType2 size={14} /> DOCX
              </a>
            </div>
            {resume && <ResumePreview resume={{ ...resume, title, sections }} scale={0.48} className="ring-1 ring-white/10 shadow-2xl shadow-indigo-500/10" />}
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
