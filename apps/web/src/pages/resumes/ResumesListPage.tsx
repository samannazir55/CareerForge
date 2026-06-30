import { useEffect, useState, type MouseEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, FileText, Trash2, Sparkles, Upload } from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { AppShell } from '../../components/layout/AppShell';

export function ResumesListPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resumeApi
      .list()
      .then((data) => setResumes(data.resumes))
      .catch(() => setError('Could not load your resumes.'));
  }, []);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const { resume } = await resumeApi.create({ title: 'Untitled Resume' });
      navigate(`/resumes/${resume.id}`);
    } catch {
      setError('Could not create a new resume.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleImportClick() {
    setIsCreating(true);
    try {
      const { resume } = await resumeApi.create({ title: 'Imported Resume' });
      navigate(`/resumes/${resume.id}/chat?import=true`);
    } catch {
      setError('Could not start the import.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setResumes((prev) => prev?.filter((r) => r.id !== id) ?? null);
    await resumeApi.remove(id).catch(() => setError('Could not delete that resume.'));
  }

  return (
    <AppShell>
      <div className="p-6 sm:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Your Resumes</h1>
          <div className="flex items-center gap-2">
            <Link to="/resumes/new/chat">
              <Button variant="secondary" size="sm">
                <Sparkles size={14} className="mr-1.5" /> AI Builder
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleImportClick} disabled={isCreating}>
              <Upload size={14} className="mr-1.5" /> Import
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} size="sm">
              <Plus size={14} className="mr-1.5" /> New resume
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {resumes === null && <p className="text-muted-foreground">Loading…</p>}

        {resumes?.length === 0 && (
          <GlassCard className="text-center">
            <p className="text-muted-foreground mb-2">You don't have any resumes yet.</p>
            <p className="text-sm text-muted-foreground mb-4">Try the AI Builder for a guided experience, or create a blank resume.</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Link to="/resumes/new/chat">
                <Button variant="secondary"><Sparkles size={14} className="mr-1.5" /> AI Builder</Button>
              </Link>
              <Button variant="outline" onClick={handleImportClick} disabled={isCreating}>
                <Upload size={14} className="mr-1.5" /> Import existing
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                <Plus size={14} className="mr-1.5" /> Blank resume
              </Button>
            </div>
          </GlassCard>
        )}

        <div className="flex flex-col gap-3">
          {resumes?.map((resume) => (
            <div
              key={resume.id}
              className="glass-panel rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-accent/40 transition-colors"
              onClick={() => navigate(`/resumes/${resume.id}`)}
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-muted-foreground" />
                <div>
                  <p className="font-medium">{resume.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(resume.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Delete resume"
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  handleDelete(resume.id);
                }}
                className="text-muted-foreground hover:text-destructive p-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
