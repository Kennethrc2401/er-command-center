import { create } from "zustand"; // If you have zustand, or use a simple context

interface PrivacyState {
  isPrivate: boolean;
  togglePrivacy: () => void;
}

export const usePrivacyMode = create<PrivacyState>((set) => ({
  isPrivate: false,
  togglePrivacy: () => set((state) => ({ isPrivate: !state.isPrivate })),
}));