import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type ActiveModal = 'new-resume' | 'template-preview' | 'upgrade' | null;

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  activeModal: ActiveModal;
  modalPayload: unknown;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  openModal: (modal: ActiveModal, payload?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  theme: (typeof window !== 'undefined'
    ? (localStorage.getItem('cf-theme') as Theme) ?? 'system'
    : 'system'),
  sidebarCollapsed: false,
  activeModal: null,
  modalPayload: null,

  setTheme: (theme) => {
    if (typeof window !== 'undefined') localStorage.setItem('cf-theme', theme);
    set({ theme });
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'light') root.classList.remove('dark');
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openModal: (activeModal, modalPayload = null) => set({ activeModal, modalPayload }),
  closeModal: () => set({ activeModal: null, modalPayload: null }),
}));
