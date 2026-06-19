import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { ResumeVersionSummary, ResumeVersionDiff } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';

export function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<ResumeVersionSummary[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState<ResumeVersionDiff | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    resumeApi
      .listVersions(id)
      .then((data) => setVersions(data.versions))
      .catch(() => setError('Could not load version history.'));
  }, [id]);

  function toggleSelect(versionId: string) {
    setDiff(null);
    setSelected((prev) => {
      if (prev.includes(versionId)) return prev.filter((v) => v !== versionId);
      if (prev.length >= 2) return [prev[1], versionId];
      return [...prev, versionId];
    });
  }

  async function handleCompare() {
    if (!id || selected.length !== 2) return;
    const [a, b] = selected;
    const { diff } = await resumeApi.compareVersions(id, a, b);
    setDiff(diff);
  }

  async function handleRestore(versionId: string) {
    if (!id) return;
    setIsRestoring(versionId);
    try {
      await resumeApi.restoreVersion(id, versionId);
      navigate(`/resumes/${id}`);
    } catch {
      setError('Could not restore that version.');
    } finally {
      setIsRestoring(null);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/resumes/${id}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-semibold">Version history</h1>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        {versions === null && <p className="text-muted-foreground">Loading…</p>}
        {versions?.length === 0 && (
          <p className="text-muted-foreground">
            No saved versions yet — use "Save version" in the editor to create one.
          </p>
        )}

        <div className="flex flex-col gap-2 mb-4">
          {versions?.map((version) => (
            <div
              key={version.id}
              className={`glass-panel rounded-xl p-4 flex items-center justify-between gap-3 ${
                selected.includes(version.id) ? 'ring-2 ring-ring' : ''
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={selected.includes(version.id)}
                  onChange={() => toggleSelect(version.id)}
                  aria-label="Select for comparison"
                />
                <div>
                  <p className="text-sm font-medium">{version.label ?? 'Autosave checkpoint'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                </div>
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={isRestoring === version.id}
                onClick={() => handleRestore(version.id)}
              >
                <RotateCcw size={14} className="mr-1.5" /> Restore
              </Button>
            </div>
          ))}
        </div>

        {selected.length === 2 && (
          <Button variant="secondary" onClick={handleCompare}>
            Compare selected
          </Button>
        )}

        {diff && (
          <GlassCard className="mt-4">
            <h2 className="font-medium mb-3">Differences</h2>
            <div className="flex flex-col gap-2 text-sm">
              {diff.sections.map((s) => (
                <div key={s.sectionId}>
                  <span
                    className={
                      s.status === 'added'
                        ? 'text-green-600'
                        : s.status === 'removed'
                          ? 'text-destructive'
                          : s.status === 'changed'
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                    }
                  >
                    {s.title}: {s.status}
                  </span>
                  {s.entries.filter((e) => e.status !== 'unchanged').length > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      ({s.entries.filter((e) => e.status !== 'unchanged').length} entr
                      {s.entries.filter((e) => e.status !== 'unchanged').length === 1 ? 'y' : 'ies'} changed)
                    </span>
                  )}
                </div>
              ))}
              {diff.sections.every((s) => s.status === 'unchanged') && (
                <p className="text-muted-foreground">No differences between these two versions.</p>
              )}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
