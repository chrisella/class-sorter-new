import type { Class, SizeCompliance } from '../types';

export function buildTargetSizes(totalStudents: number, classCount: number): number[] {
  if (classCount <= 0) return [];

  const baseSize = Math.floor(totalStudents / classCount);
  const remainder = totalStudents % classCount;

  return Array.from({ length: classCount }, (_, index) =>
    baseSize + (index >= classCount - remainder ? 1 : 0)
  );
}

export function buildClassTargetMap(classes: Class[], totalStudents: number): Record<string, number> {
  const targetSizes = buildTargetSizes(totalStudents, classes.length);
  return classes.reduce<Record<string, number>>((acc, cls, index) => {
    acc[cls.id] = targetSizes[index] ?? 0;
    return acc;
  }, {});
}

export function calculateSizeCompliance(
  classes: Class[],
  assignment: Map<string, string>,
  totalStudents: number
): SizeCompliance {
  const classTargets = buildClassTargetMap(classes, totalStudents);
  const classActualSizes = classes.reduce<Record<string, number>>((acc, cls) => {
    acc[cls.id] = 0;
    return acc;
  }, {});

  assignment.forEach((classId) => {
    if (classActualSizes[classId] !== undefined) {
      classActualSizes[classId] += 1;
    }
  });

  const classDeviations = classes.reduce<Record<string, number>>((acc, cls) => {
    acc[cls.id] = Math.abs((classActualSizes[cls.id] ?? 0) - (classTargets[cls.id] ?? 0));
    return acc;
  }, {});

  const actualSizes = classes.map((cls) => classActualSizes[cls.id] ?? 0);
  const targetSizes = classes.map((cls) => classTargets[cls.id] ?? 0);

  return {
    targetSizes,
    actualSizes,
    isExact: classes.every((cls) => (classActualSizes[cls.id] ?? 0) === (classTargets[cls.id] ?? 0)),
    maxDeviation: classes.reduce(
      (max, cls) => Math.max(max, classDeviations[cls.id] ?? 0),
      0
    ),
    classTargets,
    classActualSizes,
    classDeviations,
  };
}
