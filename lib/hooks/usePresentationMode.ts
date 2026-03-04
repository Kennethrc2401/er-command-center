import { create } from 'zustand';

interface PresentationStore {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
}

export const usePresentationMode = create<PresentationStore>((set) => ({
  isDemoMode: false,
  toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
}));