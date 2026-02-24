import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Class, SortingConfiguration, SortingResult } from '../types';

interface ClassState {
  classes: Class[];
  sortingConfig: SortingConfiguration;
  lastSortingResult: SortingResult | null;

  addClass: (name: string, targetSize: number, teacherName?: string) => string;
  updateClass: (id: string, updates: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  deleteAllClasses: () => void;
  getClassById: (id: string) => Class | undefined;

  setSortingConfig: (config: Partial<SortingConfiguration>) => void;
  setLastSortingResult: (result: SortingResult | null) => void;

  generateDefaultClasses: (count: number, totalStudents: number) => void;
}

const defaultSortingConfig: SortingConfiguration = {
  numberOfClasses: 3,
  priorityWeights: {
    friendPreference: 0.6,
    genderBalance: 0.2,
    ealBalance: 0.2,
    behaviorBalance: 0.2,
    abilityBalance: 0.2,
    ehcpBalance: 0.2,
    sendBalance: 0.2,
    ppgBalance: 0.2,
  },
  maxIterations: 10000,
};

export const useClassStore = create<ClassState>()(
  persist(
    (set, get) => ({
      classes: [],
      sortingConfig: defaultSortingConfig,
      lastSortingResult: null,

      addClass: (name, targetSize, teacherName) => {
        const id = uuidv4();
        const newClass: Class = {
          id,
          name,
          targetSize,
          teacherName,
          createdAt: new Date(),
        };
        set((state) => ({
          classes: [...state.classes, newClass],
        }));
        return id;
      },

      updateClass: (id, updates) => {
        set((state) => ({
          classes: state.classes.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteClass: (id) => {
        set((state) => ({
          classes: state.classes.filter((c) => c.id !== id),
        }));
      },

      deleteAllClasses: () => {
        set({ classes: [], lastSortingResult: null });
      },

      getClassById: (id) => {
        return get().classes.find((c) => c.id === id);
      },

      setSortingConfig: (config) => {
        set((state) => ({
          sortingConfig: { ...state.sortingConfig, ...config },
        }));
      },

      setLastSortingResult: (result) => {
        set({ lastSortingResult: result });
      },

      generateDefaultClasses: (count, totalStudents) => {
        const targetSize = Math.ceil(totalStudents / count);
        const newClasses: Class[] = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
          newClasses.push({
            id: uuidv4(),
            name: `Class ${String.fromCharCode(65 + i)}`, // Class A, B, C, etc.
            targetSize,
            createdAt: now,
          });
        }

        set({ classes: newClasses });
      },
    }),
    {
      name: 'class-sorter-classes',
    }
  )
);
