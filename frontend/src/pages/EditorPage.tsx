import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, FileText, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cvApi, templateApi } from '../services/api';
import { CVForm } from '../components/editor/CVForm';
import { CVPreview } from '../components/editor/CVPreview';
import { Button } from '../components/ui/Button';
import type { CVData, CVRecord, BackendTemplate } from '../types';
import { DEFAULT_CV_DATA } from '../types';

type MobileTab = 'form' | 'preview';

interface EditorPageProps {
  initialCV?: CVRecord | null;
  initialData?: Partial<CVData> | null;
  initialTemplateId?: string;
  onNavigateToTemplates: () => void;
}

export function EditorPage({ initialCV, initialData, initialTemplateId, onNavigateToTemplates }: EditorPageProps) {
  const { user } = useAuth();
  const [cvData, setCvData] = useState<CVData>(() => {
    const base = { ...DEFAULT_CV_DATA };
    if (initialData) Object.assign(base, initialData);
    if (initialCV?.data) {
      const d = initialCV.data as Partial<CVData>;
      Object.assign(base, d);
      if ((d as any).full_name) base.fullName = (d as any).full_name;
      if ((d as any).job_title) base.jobTitle = (d as any).job_title;
      const arrayToStr = (val: unknown): string =>
        Array.isArray(val) ? (val as string[]).join(', ') : String(val || '');
      base.skills         = arrayToStr((d as any).skills);
      base.languages      = arrayToStr((d as any).languages);
      base.hobbies        = arrayToStr((d as any).hobbies);
      base.certifications = arrayToStr((d as any).certifications);
    }
    if (user && !base.fullName) base.fullName = user.fullName || '';
    if (user && !base.email) base.email = user.email || '';
    return base;
  });

  const [activeTemplateId, setActiveTemplateId] = useState(
    initialTemplateId || initialCV?.template_id || 'modern'
  );
  const [cvId, setCvId] = useState<number | null>(initialCV?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<BackendTemplate[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>('form');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    templateApi.list().then(setTemplates).catch(console.error);
  }, []);

  const handleSave = useCallback(async (silent = false): Promise<number | null> => {
    if (!user) { if (!silent) alert('Please log in to save.'); return null; }
    setIsSaving(true);
    try {
      const payload = {
        title: `${cvData.jobTitle || cvData.fullName || 'My Resume'} — CareerForge`,
        template_id: activeTemplateId,
        data: { ...cvData },
      };
      let result: CVRecord;
      if (cvId) { result = await cvApi.update(cvId, payload); }
      else { result = await cvApi.create(payload); setCvId(result.id); }
      setSaveStatus('saved');
      clearTimeout(saveStatusTimer.current);
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 3000);
      return result.id;
    } catch {
      setSaveStatus('error');
      if (!silent) alert('Save failed. Please try again.');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [user, cvData, activeTemplateId, cvId]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!user || !cvId) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => handleSave(true), 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [cvData, activeTemplateId]); // eslint-disable-line

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-background">
      {/* Mobile tabs */}
      <div className="md:hidden flex-none p-3 glass-panel border-b border-border flex gap-2">
        <button onClick={() => setMobileTab('form')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
            mobileTab === 'form' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'
          }`}>
          <MessageSquare size={14} /> Edit
        </button>
        <button onClick={() => setMobileTab('preview')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
            mobileTab === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'
          }`}>
          <FileText size={14} /> Preview
        </button>
      </div>

      {/* Template bar */}
      <div className="flex-none px-4 py-2 border-b border-border bg-card/50 backdrop-blur flex items-center gap-3">
        <Layers size={14} className="text-muted-foreground flex-none" />
        <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setActiveTemplateId(t.id)}
              className={`flex-none px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTemplateId === t.id ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}>
              {t.is_premium ? '✨ ' : ''}{t.name}
            </button>
          ))}
          <button onClick={onNavigateToTemplates}
            className="flex-none px-3 py-1 rounded-full text-xs font-medium text-indigo-500 hover:text-indigo-600 border border-indigo-500/20 whitespace-nowrap transition-colors">
            + More Templates
          </button>
        </div>
        {saveStatus === 'saved' && <span className="text-xs text-emerald-500 font-medium flex-none">✓ Saved</span>}
        {saveStatus === 'error' && <span className="text-xs text-destructive font-medium flex-none">✗ Error</span>}
      </div>

      {/* Panels */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full md:w-[380px] lg:w-[420px] flex-none border-r border-border ${mobileTab === 'preview' ? 'hidden md:block' : 'block'}`}>
          <CVForm data={cvData} setData={setCvData} onSave={() => handleSave(false)} isSaving={isSaving} />
        </div>
        <div className={`flex-1 ${mobileTab === 'form' ? 'hidden md:block' : 'block'}`}>
          <CVPreview data={cvData} activeTemplateId={activeTemplateId} cvId={cvId} onAutoSave={() => handleSave(true)} />
        </div>
      </div>
    </div>
  );
}
