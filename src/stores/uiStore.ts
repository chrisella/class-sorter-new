import { create } from 'zustand';

type View = 'students' | 'classes' | 'sorting' | 'results';

interface UIState {
  currentView: View;
  setView: (view: View) => void;
  isSorting: boolean;
  setIsSorting: (sorting: boolean) => void;
  sortingProgress: number;
  setSortingProgress: (progress: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'students',
  setView: (view) => set({ currentView: view }),
  isSorting: false,
  setIsSorting: (sorting) => set({ isSorting: sorting }),
  sortingProgress: 0,
  setSortingProgress: (progress) => set({ sortingProgress: progress }),
}));
