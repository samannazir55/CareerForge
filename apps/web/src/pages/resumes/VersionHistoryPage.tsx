import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, GitCompare, History } from 'lucide-react';
import type { ResumeVersionSummary, ResumeVersionDiff } from '@careerforge/schema';
import { resumeApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { GlassCard } from '../../components/ui/GlassCard';
import { AppShell } from '../../components/layout/AppShell';

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
    <AppShell>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/resumes/${id}`)}
            className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-xl flex items-center justify-center hover:bg-accent transition-colors"
            aria-label="Back to editor"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center">
            <History size={16} className="text-indigo-400" />
          </div>
          <h1 className="text-xl font-semibold">Version history</h1>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        {versions === null && <p className="text-muted-foreground">Loading…</p>}
        {versions?.length === 0 && (
          <GlassCard className="text-center text-muted-foreground">
            No saved versions yet — use "Save version" in the editor to create one.
          </GlassCard>
        )}

        <div className="flex flex-col gap-2 mb-4">
          {versions?.map((version, i) => (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className={`glass-panel rounded-xl p-4 flex items-center justify-between gap-3 border transition-colors ${
                selected.includes(version.id) ? 'border-indigo-400/50 ring-1 ring-indigo-400/30' : 'border-white/10'
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selected.includes(version.id)}
                  onChange={() => toggleSelect(version.id)}
                  aria-label="Select for comparison"
                  className="accent-indigo-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{version.label ?? 'Autosave checkpoint'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                </div>
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={isRestoring === version.id}
                onClick={() => handleRestore(version.id)}
                className="shrink-0"
              >
                <RotateCcw size={14} className="mr-1.5" /> Restore
              </Button>
            </motion.div>
          ))}
        </div>

        {selected.length === 2 && (
          <Button variant="secondary" onClick={handleCompare}>
            <GitCompare size={14} className="mr-1.5" /> Compare selected
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
                        ? 'text-emerald-400'
                        : s.status === 'removed'
                          ? 'text-destructive'
                          : s.status === 'changed'
                            ? 'text-amber-400'
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
    </AppShell>
  );
}
