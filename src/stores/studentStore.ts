import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Student, Gender, Rank } from '../types';

interface StudentState {
  students: Student[];
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'assignedClassId'>) => string;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  deleteAllStudents: () => void;
  getStudentById: (id: string) => Student | undefined;
  getStudentByName: (name: string) => Student | undefined;
  importStudents: (students: Array<{
    name: string;
    gender: Gender;
    isEAL: boolean;
    behavior: Rank;
    ability: Rank;
    ehcp: boolean;
    send: boolean;
    ppg: boolean;
    preferredFriendNames: string[];
    blacklistedStudentNames: string[];
  }>) => void;
  assignStudentToClass: (studentId: string, classId: string | null) => void;
  clearAllAssignments: () => void;
}

export const useStudentStore = create<StudentState>()(
  persist(
    (set, get) => ({
      students: [],

      addStudent: (studentData) => {
        const id = uuidv4();
        const now = new Date();
        const newStudent: Student = {
          ...studentData,
          id,
          assignedClassId: null,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          students: [...state.students, newStudent],
        }));
        return id;
      },

      updateStudent: (id, updates) => {
        set((state) => ({
          students: state.students.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
          ),
        }));
      },

      deleteStudent: (id) => {
        set((state) => ({
          students: state.students
            .filter((s) => s.id !== id)
            .map((s) => ({
              ...s,
              preferredFriends: s.preferredFriends.filter((fId) => fId !== id),
              blacklistedStudents: s.blacklistedStudents.filter((bId) => bId !== id),
            })),
        }));
      },

      deleteAllStudents: () => {
        set({ students: [] });
      },

      getStudentById: (id) => {
        return get().students.find((s) => s.id === id);
      },

      getStudentByName: (name) => {
        const normalizedName = name.toLowerCase().trim();
        return get().students.find(
          (s) => s.name.toLowerCase().trim() === normalizedName
        );
      },

      importStudents: (importData) => {
        const now = new Date();

        // First pass: create all students without relationships
        const newStudents: Student[] = importData.map((data) => ({
          id: uuidv4(),
          name: data.name,
          gender: data.gender,
          isEAL: data.isEAL,
          behavior: data.behavior,
          ability: data.ability,
          ehcp: data.ehcp,
          send: data.send,
          ppg: data.ppg,
          preferredFriends: [],
          blacklistedStudents: [],
          assignedClassId: null,
          createdAt: now,
          updatedAt: now,
        }));

        // Create a name-to-id lookup including existing students
        const existingStudents = get().students;
        const allStudents = [...existingStudents, ...newStudents];
        const nameToId = new Map<string, string>();
        allStudents.forEach((s) => {
          nameToId.set(s.name.toLowerCase().trim(), s.id);
        });

        // Second pass: resolve relationships
        newStudents.forEach((student, index) => {
          const data = importData[index];

          // Resolve preferred friends
          student.preferredFriends = data.preferredFriendNames
            .map((name) => nameToId.get(name.toLowerCase().trim()))
            .filter((id): id is string => id !== undefined && id !== student.id)
            .slice(0, 3);

          // Resolve blacklisted students
          student.blacklistedStudents = data.blacklistedStudentNames
            .map((name) => nameToId.get(name.toLowerCase().trim()))
            .filter((id): id is string => id !== undefined && id !== student.id);
        });

        set((state) => ({
          students: [...state.students, ...newStudents],
        }));
      },

      assignStudentToClass: (studentId, classId) => {
        set((state) => ({
          students: state.students.map((s) =>
            s.id === studentId ? { ...s, assignedClassId: classId, updatedAt: new Date() } : s
          ),
        }));
      },

      clearAllAssignments: () => {
        set((state) => ({
          students: state.students.map((s) => ({
            ...s,
            assignedClassId: null,
            updatedAt: new Date(),
          })),
        }));
      },
    }),
    {
      name: 'class-sorter-students',
    }
  )
);
