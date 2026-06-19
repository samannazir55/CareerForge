import { useEffect, useState, } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2 } from 'lucide-react';
import type { ResumeSummary } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export function ResumesListPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
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

  async function handleDelete(id: string) {
    setResumes((prev) => prev?.filter((r) => r.id !== id) ?? null);
    await resumeApi.remove(id).catch(() => setError('Could not delete that resume.'));
  }

  return (
    <div className="min-h-screen w-full bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gradient">Your resumes</h1>
          <div className="flex items-center gap-2">
            <Button onClick={handleCreate} disabled={isCreating}>
              <Plus size={16} className="mr-1.5" /> New resume
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {resumes === null && <p className="text-muted-foreground">Loading…</p>}

        {resumes?.length === 0 && (
          <GlassCard className="text-center">
            <p className="text-muted-foreground mb-4">You don't have any resumes yet.</p>
            <Button onClick={handleCreate} disabled={isCreating}>
              Create your first resume
            </Button>
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
                onClick={(e: { stopPropagation(): void }) => {
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
    </div>
  );
}
