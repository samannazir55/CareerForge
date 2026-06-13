import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Mustache from 'mustache';
import { Save, Download, ZoomIn, ZoomOut, LayoutTemplate, ChevronDown, MessageSquare, FileText, Loader2, CheckCircle, Lock, Crown, Eye } from 'lucide-react';
import { unlockTemplate, getUnlockedTemplates } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { createCV, updateCV, getTemplate, getTemplates, exportCV } from '../../services/api';
import { CVData, DEFAULT_CV_DATA, Template } from '../../types';

// ─── CV Form ─────────────────────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <label className="block text-[12px] font-medium text-muted-foreground mb-1">{label}</label>
    {children}
  </div>
);

const inputCls = "w-full px-3 py-2 rounded-xl border border-border bg-card text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-all";
const textareaCls = `${inputCls} resize-none`;

interface CVFormProps { data: CVData; onChange: (d: CVData) => void; }

const CVForm = ({ data, onChange }: CVFormProps) => {
  const set = (key: keyof CVData, val: string) => onChange({ ...data, [key]: val });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('profileImage', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="px-5 py-5 overflow-y-auto thin-scrollbar h-full">
      {/* Profile image */}
      <div className="flex justify-center mb-5">
        <button onClick={() => fileRef.current?.click()} className="relative group">
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border overflow-hidden flex items-center justify-center">
            {data.profileImage
              ? <img src={data.profileImage} className="w-full h-full object-cover" alt="profile" />
              : <span className="text-2xl text-muted-foreground">📷</span>}
          </div>
          <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-[10px] font-medium">Change</span>
          </div>
        </button>
        <input ref={fileRef} type="file" hidden accept="image/*" onChange={handleImage} />
      </div>

      <Section title="Basic Info">
        <Field label="Full Name"><input className={inputCls} value={data.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Alex Johnson" /></Field>
        <Field label="Job Title"><input className={inputCls} value={data.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Senior Software Engineer" /></Field>
        <Field label="Email"><input className={inputCls} value={data.email} onChange={e => set('email', e.target.value)} type="email" /></Field>
        <Field label="Phone"><input className={inputCls} value={data.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" /></Field>
        <Field label="Location"><input className={inputCls} value={data.location} onChange={e => set('location', e.target.value)} placeholder="New York, NY" /></Field>
      </Section>

      <Section title="Content">
        <Field label="Professional Summary"><textarea className={textareaCls} rows={4} value={data.summary} onChange={e => set('summary', e.target.value)} placeholder="Results-driven professional with…" /></Field>
        <Field label="Experience"><textarea className={textareaCls} rows={6} value={data.experience} onChange={e => set('experience', e.target.value)} placeholder="• Led team of 8 engineers&#10;• Increased revenue by 40%" /></Field>
        <Field label="Education"><textarea className={textareaCls} rows={3} value={data.education} onChange={e => set('education', e.target.value)} /></Field>
        <Field label="Skills (comma separated)"><textarea className={textareaCls} rows={2} value={data.skills} onChange={e => set('skills', e.target.value)} placeholder="Python, React, SQL, Leadership" /></Field>
      </Section>

      <Section title="Sidebar Content">
        <Field label="Hobbies / Interests"><input className={inputCls} value={data.hobbies} onChange={e => set('hobbies', e.target.value)} placeholder="Photography, Hiking, Reading" /></Field>
        <Field label="Languages"><input className={inputCls} value={data.languages} onChange={e => set('languages', e.target.value)} placeholder="English (Native), Spanish (B2)" /></Field>
        <Field label="Certifications"><input className={inputCls} value={data.certifications} onChange={e => set('certifications', e.target.value)} placeholder="AWS Certified, PMP, CISSP" /></Field>
      </Section>

      <Section title="Social Links">
        <Field label="LinkedIn"><input className={inputCls} value={data.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/yourprofile" /></Field>
        <Field label="GitHub"><input className={inputCls} value={data.github} onChange={e => set('github', e.target.value)} placeholder="github.com/yourusername" /></Field>
        <Field label="Portfolio"><input className={inputCls} value={data.portfolio} onChange={e => set('portfolio', e.target.value)} placeholder="yourportfolio.com" /></Field>
      </Section>

      <Section title="Theme">
        <div className="flex gap-3">
          <Field label="Accent Color">
            <input type="color" value={data.accentColor} onChange={e => set('accentColor', e.target.value)}
              className="w-full h-9 rounded-xl border border-border cursor-pointer" />
          </Field>
          <Field label="Text Color">
            <input type="color" value={data.textColor} onChange={e => set('textColor', e.target.value)}
              className="w-full h-9 rounded-xl border border-border cursor-pointer" />
          </Field>
        </div>
        <Field label="Font Family">
          <select className={inputCls} value={data.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
            <option value="Inter, sans-serif">Inter</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="Arial, sans-serif">Arial</option>
          </select>
        </Field>
      </Section>
    </div>
  );
};

// ─── Preview Panel ────────────────────────────────────────────────────────────
const CVPreviewPanel = ({ data, template }: { data: CVData; template: Template | null }) => {
  const stripHash = (c: string) => c?.replace(/#/g, '') || '333333';
  const skillsArr = typeof data.skills === 'string'
    ? data.skills.split(',').map(s => s.trim()).filter(Boolean)
    : (data.skills as any) || [];

  const pData = {
    ...data,
    full_name: data.fullName || 'Your Name',
    job_title: data.jobTitle || 'Job Title',
    full_name_initials: (data.fullName || 'YN').split(' ').map((n: string) => n[0]).slice(0, 2).join(''),
    experience: (data.experience || '').replace(/\n/g, '<br/>'),
    education: (data.education || '').replace(/\n/g, '<br/>'),
    skills: skillsArr,
    accent_color: stripHash(data.accentColor || '#6D5FFA'),
    text_color: stripHash(data.textColor || '#333333'),
    font_family: data.fontFamily || 'Inter, sans-serif',
    profile_image: data.profileImage || '',
  };

  if (!template?.html_content) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Loading template…</p>
        </div>
      </div>
    );
  }

  let htmlContent = '';
  let scopedCss = '';
  try {
    htmlContent = Mustache.render(template.html_content, pData);
    let css = template.css_styles || '';
    css = css.replace(/:(\s*){{accent_color}}/g, ': #{{accent_color}}');
    css = css.replace(/:(\s*){{text_color}}/g, ': #{{text_color}}');
    const renderedCss = Mustache.render(css, pData);
    scopedCss = `#cf-preview { --primary: #${pData.accent_color}; --text-main: #${pData.text_color}; font-family: ${pData.font_family}; width: 100%; min-height: 100%; background: white; } ${renderedCss}`;
  } catch (e) {
    htmlContent = `<div style="padding:20px;color:red">Template render error: ${e}</div>`;
  }

  return (
    <div id="cf-preview" style={{ width: '100%', minHeight: '100%', background: 'white' }}>
      <style>{scopedCss}</style>
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </div>
  );
};

// ─── Main Editor Page ─────────────────────────────────────────────────────────
export const EditorPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [cvData, setCvData] = useState<CVData>(DEFAULT_CV_DATA);
  const [cvId, setCvId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockingTemplate, setUnlockingTemplate] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState('modern');
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [scale, setScale] = useState(0.72);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const processedKey = useRef<string | null>(null);

  // Load templates
  useEffect(() => {
    Promise.all([
      getTemplates(),
      user ? getUnlockedTemplates() : Promise.resolve([]),
    ]).then(([tmpl, unl]) => {
      setTemplates(tmpl);
      setUnlockedIds(unl);
    }).catch(console.error);
  }, []);

  // Load template HTML when activeTemplateId changes
  useEffect(() => {
    if (!activeTemplateId) return;
    getTemplate(activeTemplateId).then(setActiveTemplate).catch(() => {
      const found = templates.find(t => t.id === activeTemplateId);
      if (found) setActiveTemplate(found);
    });
  }, [activeTemplateId, templates]);

  // Scale based on container width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setScale(Math.min((w - 48) / 794, 1));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Outside click for dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowTemplateDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Populate from navigation state or sessionStorage
  useEffect(() => {
    if (processedKey.current === location.key) return;
    processedKey.current = location.key;

    let incoming: any = null;

    if (location.state?.existingCV) {
      incoming = location.state.existingCV;
    } else if (location.state?.generatedContent) {
      incoming = location.state.generatedContent;
    } else {
      const stored = sessionStorage.getItem('cf_ai_result');
      if (stored) {
        try { incoming = JSON.parse(stored); } catch { }
        sessionStorage.removeItem('cf_ai_result');
      }
    }

    if (location.state?.forceTemplate) {
      setActiveTemplateId(location.state.forceTemplate);
    }

    if (incoming) {
      const record = incoming.data ? incoming : { data: incoming };
      const d = record.data || record;
      const processArr = (v: any) => Array.isArray(v) ? v.map((p: string) => `• ${p}`).join('\n') : (v || '');
      const processList = (v: any) => Array.isArray(v) ? v.join(', ') : (v || '');

      setCvData(prev => ({
        ...prev,
        fullName: d.fullName || d.full_name || user?.full_name || prev.fullName,
        email: d.email || user?.email || prev.email,
        phone: d.phone || prev.phone,
        jobTitle: d.jobTitle || d.job_title || d.desired_job_title || prev.jobTitle,
        summary: d.summary || d.professional_summary || prev.summary,
        experience: processArr(d.experience || d.experience_points),
        education: d.education || d.education_formatted || prev.education,
        skills: processList(d.skills || d.suggested_skills),
        location: d.location || prev.location,
        hobbies: processList(d.hobbies),
        languages: processList(d.languages),
        certifications: processList(d.certifications),
        linkedin: d.linkedin || prev.linkedin,
        github: d.github || prev.github,
        portfolio: d.portfolio || prev.portfolio,
        accentColor: d.accentColor || prev.accentColor,
        textColor: d.textColor || prev.textColor,
        fontFamily: d.fontFamily || prev.fontFamily,
        profileImage: d.profileImage || prev.profileImage,
      }));

      if (record.id) setCvId(record.id);
      if (record.template_id && !location.state?.forceTemplate) setActiveTemplateId(record.template_id);
    } else if (user) {
      setCvData(prev => ({
        ...prev,
        fullName: prev.fullName || user.full_name || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [location.key, location.state, user]);

  const hasDownloadAccess = () => {
    if (!activeTemplate) return true;
    if (!activeTemplate.is_premium) return true;
    if (user?.subscription_plan === 'premium') return true;
    return unlockedIds.includes(activeTemplateId);
  };

  const handleUnlockAndExport = async (type: 'pdf' | 'docx') => {
    if (!activeTemplate || !user) return;
    setUnlockingTemplate(true);
    try {
      await unlockTemplate(activeTemplateId);
      setUnlockedIds(prev => [...prev, activeTemplateId]);
      setShowUnlockModal(false);
      await handleExport(type);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Unlock failed. Please check your credits.');
    } finally {
      setUnlockingTemplate(false);
    }
  };

  const handleSave = useCallback(async (silent = false): Promise<number | null> => {
    if (!user) { if (!silent) navigate('/login'); return null; }
    setSaving(true);
    try {
      const payload = {
        title: `${cvData.jobTitle || cvData.fullName || 'Resume'} — ${new Date().toLocaleDateString()}`,
        template_id: activeTemplateId,
        data: cvData,
      };
      let res;
      if (cvId) {
        res = await updateCV(cvId, payload);
      } else {
        res = await createCV(payload);
        setCvId(res.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return res.id;
    } catch (e: any) {
      if (!silent) alert('Save failed: ' + (e.message || 'Unknown error'));
      return null;
    } finally {
      setSaving(false);
    }
  }, [user, cvData, activeTemplateId, cvId, navigate]);

  const handleExport = async (type: 'pdf' | 'docx') => {
    if (!user) { navigate('/login'); return; }
    // Gate premium template downloads
    if (!hasDownloadAccess()) {
      setShowUnlockModal(true);
      return;
    }
    setDownloading(true);
    try {
      let id = cvId;
      if (!id) { id = await handleSave(true); }
      if (!id) { alert('Please save the CV first.'); return; }
      const blob = await exportCV(id, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cvData.fullName || 'resume'}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-3.5rem)] flex flex-col bg-background overflow-hidden">
      {/* Editor toolbar */}
      <div className="flex-none h-12 px-4 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2">
          {/* Template picker */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setShowTemplateDropdown(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-xl text-[12px] font-medium hover:bg-accent transition-colors shadow-sm">
              <LayoutTemplate size={13} className="text-muted-foreground" />
              <span className="hidden sm:inline">{templates.find(t => t.id === activeTemplateId)?.name || 'Template'}</span>
              <ChevronDown size={11} className="text-muted-foreground" />
            </button>
            {showTemplateDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 border-b border-border">Templates</div>
                <div className="max-h-52 overflow-y-auto thin-scrollbar py-1">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => { setActiveTemplateId(t.id); setShowTemplateDropdown(false); }}
                      className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[13px] hover:bg-accent transition-colors ${activeTemplateId === t.id ? 'font-semibold text-violet-600 dark:text-violet-400' : ''}`}>
                      {activeTemplateId === t.id && <CheckCircle size={12} className="text-violet-500" />}
                      {activeTemplateId !== t.id && <div className="w-3" />}
                      <span>{t.name}</span>
                      {t.is_premium && <span className="ml-auto text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">PRO</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat link */}
          <button onClick={() => navigate('/chat')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <MessageSquare size={13} />
            <span className="hidden sm:inline">AI Chat</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom (desktop only) */}
          <div className="hidden lg:flex items-center gap-1 bg-card border border-border rounded-xl p-0.5">
            <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"><ZoomOut size={13} /></button>
            <span className="text-[11px] font-medium w-9 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(1.4, s + 0.1))} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"><ZoomIn size={13} /></button>
          </div>

          {/* Save */}
          <motion.button onClick={() => handleSave(false)} disabled={saving}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all shadow-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-gradient-violet text-white glow-sm'}`}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : <Save size={13} />}
            <span className="hidden sm:inline">{saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}</span>
          </motion.button>

          {/* Export */}
          <div className="flex items-center gap-1">
            <button onClick={() => handleExport('pdf')} disabled={downloading}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-accent transition-colors ${!hasDownloadAccess() ? 'opacity-70' : ''}`}>
              {downloading ? <Loader2 size={12} className="animate-spin" /> : hasDownloadAccess() ? <Download size={12} /> : <Lock size={12} />}
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button onClick={() => handleExport('docx')} disabled={downloading}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-card text-[12px] font-medium hover:bg-accent transition-colors ${!hasDownloadAccess() ? 'opacity-70' : ''}`}>
              {hasDownloadAccess() ? <Download size={12} /> : <Lock size={12} />}
              <span className="hidden sm:inline">DOCX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex-none flex gap-2 px-4 py-2 bg-background border-b border-border">
        {(['form', 'preview'] as const).map(v => (
          <button key={v} onClick={() => setMobileView(v)}
            className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-all ${mobileView === v ? 'bg-gradient-violet text-white' : 'bg-muted text-muted-foreground'}`}>
            {v === 'form' ? '✏️ Edit' : '👁 Preview'}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form panel */}
        <div className={`w-full md:w-80 lg:w-96 flex-none border-r border-border bg-background overflow-hidden flex flex-col ${mobileView === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          <CVForm data={cvData} onChange={setCvData} />
        </div>

        {/* Preview panel */}
        <div ref={containerRef} className={`flex-1 overflow-auto dot-grid flex items-start justify-center p-6 ${mobileView === 'form' ? 'hidden md:flex' : 'flex'}`}>
          <div style={{ width: 794, minHeight: 1123, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            <CVPreviewPanel data={cvData} template={activeTemplate} />
          </div>
        </div>
      </div>
      {/* Preview mode banner for premium templates */}
      {activeTemplate?.is_premium && !hasDownloadAccess() && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500 text-white shadow-xl">
            <Eye size={16} />
            <span className="text-[13px] font-semibold">Preview Mode</span>
            <span className="text-[12px] opacity-80">— Unlock to download</span>
            <button onClick={() => setShowUnlockModal(true)}
              className="ml-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[12px] font-bold transition-colors flex items-center gap-1">
              <Lock size={11} /> Unlock
            </button>
          </motion.div>
        </div>
      )}

      {/* Unlock modal */}
      <AnimatePresence>
        {showUnlockModal && activeTemplate?.is_premium && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/75 backdrop-blur-md"
              onClick={() => setShowUnlockModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }} className="relative w-full max-w-sm glass rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-7">
                <button onClick={() => setShowUnlockModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors">
                  ✕
                </button>
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Lock size={22} />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-center mb-2">Unlock to download</h2>
                <p className="text-[13px] text-muted-foreground text-center mb-6 leading-relaxed">
                  <strong className="text-foreground">{activeTemplate.name}</strong> is a premium template.
                  Unlock it with 1 credit to download as PDF or DOCX.
                </p>
                <div className="space-y-2.5">
                  <button onClick={() => handleUnlockAndExport('pdf')} disabled={unlockingTemplate}
                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    {unlockingTemplate ? 'Unlocking…' : <><Lock size={14} /> Unlock & Download PDF</>}
                  </button>
                  <button onClick={() => { setShowUnlockModal(false); navigate('/dashboard'); }}
                    className="w-full py-3 rounded-xl bg-gradient-violet text-white font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Crown size={14} /> Upgrade Plan — All templates free
                  </button>
                  <button onClick={() => setShowUnlockModal(false)}
                    className="w-full py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted transition-colors">
                    Cancel — keep previewing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
