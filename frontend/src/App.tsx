import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { TopNav } from './components/layout/TopNav';
import { AIChatPage } from './components/chat/AIChatPage';
import { EditorPage } from './pages/EditorPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import type { CVData, CVRecord } from './types';
import { DEFAULT_CV_DATA } from './types';

export type AppView = 'chat' | 'editor' | 'marketplace' | 'dashboard';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [view, setView] = useState<AppView>('chat');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Shared state flowing between Chat → Editor
  const [pendingCVData, setPendingCVData] = useState<Partial<CVData> | null>(null);
  const [editingCV, setEditingCV] = useState<CVRecord | null>(null);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const processedLocationKey = useRef<string | null>(null);

  // Theme initialisation from system preference
  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Handle navigation state from React Router (e.g. coming from DashboardPage.handleEdit)
  useEffect(() => {
    if (processedLocationKey.current === location.key) return;
    processedLocationKey.current = location.key;

    const state = location.state as Record<string, unknown> | null;
    if (!state) return;

    if (state.existingCV) {
      setEditingCV(state.existingCV as CVRecord);
      setView('editor');
    }
    if (state.forceTemplate) {
      setEditorTemplateId(state.forceTemplate as string);
      setView('editor');
    }
    if (state.generatedContent) {
      setPendingCVData(state.generatedContent as Partial<CVData>);
      setView('editor');
    }

    // Clean navigation state
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.key, location.state, navigate]);

  // --- Callbacks passed to child pages ---

  /** Called by AIChatPage when AI returns generated CV data */
  const handleResumeGenerated = useCallback((data: Record<string, unknown>) => {
    // Normalise snake_case → camelCase fields from the AI service
    const normalised: Partial<CVData> = {
      fullName: (data.full_name as string) || (data.fullName as string) || '',
      email: (data.email as string) || '',
      phone: (data.phone as string) || '',
      jobTitle:
        (data.desired_job_title as string) ||
        (data.jobTitle as string) ||
        (data.job_title as string) ||
        '',
      summary:
        (data.professional_summary as string) ||
        (data.summary as string) ||
        '',
      experience: Array.isArray(data.experience_points)
        ? (data.experience_points as string[]).map((p) => `• ${p}`).join('\n')
        : ((data.experience as string) || ''),
      education:
        (data.education_formatted as string) ||
        (data.education as string) ||
        '',
      skills: Array.isArray(data.suggested_skills)
        ? (data.suggested_skills as string[]).join(', ')
        : (typeof data.skills === 'string' ? data.skills : ''),
    };

    // Store in sessionStorage as fallback (mirrors Project A behaviour)
    try {
      sessionStorage.setItem('cf_aiResult', JSON.stringify(normalised));
    } catch { /* ignore */ }

    setPendingCVData(normalised);
    setEditingCV(null);
  }, []);

  /** Navigate to editor after AI generation */
  const handleNavigateToEditor = useCallback(() => {
    setView('editor');
  }, []);

  /** Called by DashboardPage when user clicks Edit on a CV */
  const handleEditCV = useCallback((cv: CVRecord) => {
    setEditingCV(cv);
    setPendingCVData(null);
    setView('editor');
  }, []);

  /** Called by MarketplacePage when user selects/unlocks a template */
  const handleTemplateSelected = useCallback((templateId: string) => {
    setEditorTemplateId(templateId);
  }, []);

  const handleNavigation = useCallback((dest: AppView) => {
    setView(dest);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Top navigation bar */}
      <TopNav
        currentView={view}
        onNavigate={handleNavigation}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Page content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'chat' && (
            <motion.div key="chat" {...pageVariants} className="absolute inset-0">
              <AIChatPage
                onResumeGenerated={handleResumeGenerated}
                onNavigateToEditor={handleNavigateToEditor}
              />
            </motion.div>
          )}

          {view === 'editor' && (
            <motion.div key="editor" {...pageVariants} className="absolute inset-0">
              <EditorPage
                initialCV={editingCV}
                initialData={pendingCVData}
                onNavigateToTemplates={() => setView('marketplace')}
              />
            </motion.div>
          )}

          {view === 'marketplace' && (
            <motion.div key="marketplace" {...pageVariants} className="absolute inset-0 overflow-y-auto">
              <MarketplacePage
                onTemplateSelected={handleTemplateSelected}
                onNavigateToEditor={() => setView('editor')}
              />
            </motion.div>
          )}

          {view === 'dashboard' && (
            <motion.div key="dashboard" {...pageVariants} className="absolute inset-0 overflow-y-auto">
              <DashboardPage
                onNavigate={handleNavigation}
                onEditCV={handleEditCV}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
