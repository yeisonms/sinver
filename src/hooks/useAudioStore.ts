import { create } from "zustand";

interface AudioStore {
    silencedIds: string[];
    silenceOrder: (id: string) => void;
    clearSilenced: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
    silencedIds: [],
    silenceOrder: (id) =>
        set((state) => ({
            silencedIds: state.silencedIds.includes(id) ? state.silencedIds : [...state.silencedIds, id],
        })),
    clearSilenced: () => set({ silencedIds: [] }),
}));
