import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { TopNav } from './components/layout/TopNav';
import { AIChatPage } from './components/chat/AIChatPage';
import { EditorPage } from './pages/EditorPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LoginPage, RegisterPage, VerifyOTPPage } from './components/auth/AuthPages';

import type { CVData, CVRecord } from './types';

export type AppView = 'chat' | 'editor' | 'marketplace' | 'dashboard';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  const [view, setView] = useState<AppView>('chat');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pendingCVData, setPendingCVData] = useState<Partial<CVData> | null>(null);
  const [editingCV, setEditingCV] = useState<CVRecord | null>(null);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const processedLocationKey = useRef<string | null>(null);

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (processedLocationKey.current === location.key) return;
    processedLocationKey.current = location.key;
    const state = location.state as Record<string, unknown> | null;
    if (!state) return;
    if (state.existingCV) { setEditingCV(state.existingCV as CVRecord); setView('editor'); }
    if (state.forceTemplate) { setEditorTemplateId(state.forceTemplate as string); setView('editor'); }
    if (state.generatedContent) { setPendingCVData(state.generatedContent as Partial<CVData>); setView('editor'); }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.key, location.state, navigate]);

  const handleResumeGenerated = useCallback((data: Record<string, unknown>) => {
    const normalised: Partial<CVData> = {
      fullName: (data.full_name as string) || (data.fullName as string) || '',
      email: (data.email as string) || '',
      phone: (data.phone as string) || '',
      jobTitle: (data.desired_job_title as string) || (data.jobTitle as string) || '',
      summary: (data.professional_summary as string) || (data.summary as string) || '',
      experience: Array.isArray(data.experience_points)
        ? (data.experience_points as string[]).map((p) => `• ${p}`).join('\n')
        : ((data.experience as string) || ''),
      education: (data.education_formatted as string) || (data.education as string) || '',
      skills: Array.isArray(data.suggested_skills)
        ? (data.suggested_skills as string[]).join(', ')
        : (typeof data.skills === 'string' ? data.skills : ''),
    };
    try { sessionStorage.setItem('cf_aiResult', JSON.stringify(normalised)); } catch { }
    setPendingCVData(normalised);
    setEditingCV(null);
  }, []);

  const handleNavigateToEditor = useCallback(() => { setView('editor'); }, []);
  const handleEditCV = useCallback((cv: CVRecord) => {
    setEditingCV(cv); setPendingCVData(null); setView('editor');
  }, []);
  const handleTemplateSelected = useCallback((templateId: string) => {
    setEditorTemplateId(templateId);
  }, []);
  const handleNavigation = useCallback((dest: AppView) => { setView(dest); }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-xl bg-gradient-violet animate-pulse" />
      </div>
    );
  }

  // ── Not logged in — show auth pages ──────────────────────────────────────────
  if (!user) {
    if (localStorage.getItem('cf_pending_email') || location.pathname === '/verify-otp') {
      return <VerifyOTPPage />;
    }
    if (location.pathname === '/register') {
      return <RegisterPage />;
    }
    return <LoginPage />;
  }

  // ── Logged in — main app (no AnimatePresence to avoid framer-motion crash) ───
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <TopNav
        currentView={view}
        onNavigate={handleNavigation}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="flex-1 overflow-hidden relative">
        {view === 'chat' && (
          <div className="absolute inset-0">
            <AIChatPage
              onResumeGenerated={handleResumeGenerated}
              onNavigateToEditor={handleNavigateToEditor}
            />
          </div>
        )}
        {view === 'editor' && (
          <div className="absolute inset-0">
            <EditorPage
              initialCV={editingCV ? { ...editingCV, template_id: editorTemplateId || editingCV.template_id } : null}
              initialData={pendingCVData}
              initialTemplateId={editorTemplateId || undefined}
              onNavigateToTemplates={() => setView('marketplace')}
            />
          </div>
        )}
        {view === 'marketplace' && (
          <div className="absolute inset-0 overflow-y-auto">
            <MarketplacePage
              onTemplateSelected={handleTemplateSelected}
              onNavigateToEditor={() => setView('editor')}
            />
          </div>
        )}
        {view === 'dashboard' && (
          <div className="absolute inset-0 overflow-y-auto">
            <DashboardPage
              onNavigate={handleNavigation}
              onEditCV={handleEditCV}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;