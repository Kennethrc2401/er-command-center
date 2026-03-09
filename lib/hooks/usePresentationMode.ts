import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PresentationStore {
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  toggleDemoMode: () => void;
}

export const usePresentationMode = create<PresentationStore>()(
  persist(
    (set) => ({
      isDemoMode: false,
      setDemoMode: (enabled) => set({ isDemoMode: enabled }),
      toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
    }),
    {
      name: "er-presentation-mode",
    }
  )
);