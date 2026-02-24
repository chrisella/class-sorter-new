import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Student, Gender, Rank } from '../types';

type PairUpdateResult = {
  students: Student[];
  error?: string;
};

function applyMustBeWithPair(
  students: Student[],
  studentId: string,
  targetId: string | null
): PairUpdateResult {
  const studentMap = new Map(
    students.map((student) => [student.id, { ...student }])
  );
  const student = studentMap.get(studentId);
  if (!student) {
    return { students, error: 'Student not found.' };
  }

  const detachPair = (id: string) => {
    const current = studentMap.get(id);
    if (!current) return;
    const partnerId = current.mustBeWithStudentId;
    current.mustBeWithStudentId = null;
    current.updatedAt = new Date();
    if (!partnerId) return;

    const partner = studentMap.get(partnerId);
    if (partner?.mustBeWithStudentId === id) {
      partner.mustBeWithStudentId = null;
      partner.updatedAt = new Date();
    }
  };

  if (targetId === null) {
    detachPair(studentId);
    return {
      students: students.map((s) => studentMap.get(s.id) ?? s),
    };
  }

  if (targetId === studentId) {
    return { students, error: 'A student cannot be paired with themselves.' };
  }

  const target = studentMap.get(targetId);
  if (!target) {
    return { students, error: 'Selected partner was not found.' };
  }

  const hasBlacklistConflict =
    student.blacklistedStudents.includes(targetId) ||
    target.blacklistedStudents.includes(studentId);
  if (hasBlacklistConflict) {
    return { students, error: 'Students who are blacklisted cannot be set as must-be-with.' };
  }

  detachPair(studentId);
  detachPair(targetId);

  const now = new Date();
  const refreshedStudent = studentMap.get(studentId);
  const refreshedTarget = studentMap.get(targetId);
  if (refreshedStudent && refreshedTarget) {
    refreshedStudent.mustBeWithStudentId = targetId;
    refreshedStudent.updatedAt = now;
    refreshedTarget.mustBeWithStudentId = studentId;
    refreshedTarget.updatedAt = now;
  }

  return {
    students: students.map((s) => studentMap.get(s.id) ?? s),
  };
}

interface StudentState {
  students: Student[];
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'assignedClassId'>) => string;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  setMustBeWithPair: (
    studentId: string,
    targetId: string | null
  ) => { success: boolean; error?: string };
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
    mustBeWithStudentName?: string;
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
        set((state) => {
          const nextStudents = [...state.students, newStudent];
          if (!newStudent.mustBeWithStudentId) {
            return { students: nextStudents };
          }

          const pairResult = applyMustBeWithPair(
            nextStudents,
            id,
            newStudent.mustBeWithStudentId
          );
          if (pairResult.error) {
            throw new Error(pairResult.error);
          }
          return { students: pairResult.students };
        });
        return id;
      },

      updateStudent: (id, updates) => {
        const { mustBeWithStudentId, ...restUpdates } = updates;
        set((state) => {
          let nextStudents = state.students.map((s) =>
            s.id === id ? { ...s, ...restUpdates, updatedAt: new Date() } : s
          );

          if (mustBeWithStudentId !== undefined) {
            const pairResult = applyMustBeWithPair(
              nextStudents,
              id,
              mustBeWithStudentId
            );
            if (pairResult.error) {
              return { students: state.students };
            }
            nextStudents = pairResult.students;
          }

          return { students: nextStudents };
        });
      },

      setMustBeWithPair: (studentId, targetId) => {
        let pairError: string | undefined;
        set((state) => {
          const pairResult = applyMustBeWithPair(state.students, studentId, targetId);
          pairError = pairResult.error;
          if (pairResult.error) {
            return { students: state.students };
          }
          return { students: pairResult.students };
        });

        if (pairError) {
          return { success: false, error: pairError };
        }
        return { success: true };
      },

      deleteStudent: (id) => {
        set((state) => ({
          students: state.students
            .filter((s) => s.id !== id)
            .map((s) => ({
              ...s,
              preferredFriends: s.preferredFriends.filter((fId) => fId !== id),
              blacklistedStudents: s.blacklistedStudents.filter((bId) => bId !== id),
              mustBeWithStudentId: s.mustBeWithStudentId === id ? null : s.mustBeWithStudentId,
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
          mustBeWithStudentId: null,
          preferredFriends: [],
          blacklistedStudents: [],
          assignedClassId: null,
          createdAt: now,
          updatedAt: now,
        }));

        // Create a name-to-id lookup including existing students
        const existingStudents = get().students.map((s) => ({ ...s }));
        let allStudents = [...existingStudents, ...newStudents];
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

        // Third pass: resolve must-be-with pairs
        for (let index = 0; index < newStudents.length; index++) {
          const data = importData[index];
          const student = newStudents[index];
          const targetName = data.mustBeWithStudentName?.trim();
          if (!targetName) continue;

          const targetId = nameToId.get(targetName.toLowerCase());
          if (!targetId || targetId === student.id) {
            throw new Error(
              `Invalid must-be-with value "${targetName}" for ${student.name}.`
            );
          }

          const pairResult = applyMustBeWithPair(allStudents, student.id, targetId);
          if (pairResult.error) {
            throw new Error(`${student.name}: ${pairResult.error}`);
          }
          allStudents = pairResult.students;
        }

        set({
          students: allStudents,
        });
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
