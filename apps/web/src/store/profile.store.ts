import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProfileWithFacts, ProfileFact } from '@careerforge/schema';

interface ProfileState {
  profile: ProfileWithFacts | null;
  isLoading: boolean;
  error: string | null;
  setProfile: (profile: ProfileWithFacts) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  optimisticUpsertFact: (fact: ProfileFact) => void;
  optimisticDeleteFact: (key: string) => void;
  reset: () => void;
}

const initialState = {
  profile: null,
  isLoading: false,
  error: null,
};

export const useProfileStore = create<ProfileState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setProfile: (profile) => set({ profile, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      optimisticUpsertFact: (fact) => {
        const current = get().profile;
        if (!current) return;
        const existing = current.facts.findIndex((f) => f.key === fact.key);
        const nextFacts =
          existing >= 0
            ? current.facts.map((f, i) => (i === existing ? fact : f))
            : [...current.facts, fact];
        set({ profile: { ...current, facts: nextFacts } });
      },

      optimisticDeleteFact: (key) => {
        const current = get().profile;
        if (!current) return;
        set({ profile: { ...current, facts: current.facts.filter((f) => f.key !== key) } });
      },

      reset: () => set(initialState),
    }),
    { name: 'profile-store' },
  ),
);
