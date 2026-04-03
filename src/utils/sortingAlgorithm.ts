import type {
  Student,
  Class,
  SortingConfiguration,
  SortingResult,
  ClassStatistics,
  SatisfactionScore,
  ConstraintViolation,
  ClassSizeMode,
  SizeCompliance,
} from '../types';
import { buildTargetSizes, calculateSizeCompliance } from './classSizeUtils';

type Assignment = Map<string, string>;

interface EvaluationResult {
  violations: ConstraintViolation[];
  blacklistCount: number;
  mustBeWithCount: number;
  softScore: number;
  overallScore: number;
  sizeCompliance: SizeCompliance;
}

const FLEXIBLE_SIZE_WARNING_THRESHOLD = 1;
const BLACKLIST_PENALTY = 1_000_000;
const MUST_BE_WITH_PENALTY = 1_000;

export async function runSorting(
  students: Student[],
  classes: Class[],
  config: SortingConfiguration,
  onProgress?: (progress: number) => void
): Promise<SortingResult> {
  const normalizedConfig = normalizeSortingConfig(config);
  return normalizedConfig.classSizeMode === 'strict'
    ? runStrictSorting(students, classes, normalizedConfig, onProgress)
    : runFlexibleSorting(students, classes, normalizedConfig, onProgress);
}

async function runFlexibleSorting(
  students: Student[],
  classes: Class[],
  config: SortingConfiguration,
  onProgress?: (progress: number) => void
): Promise<SortingResult> {
  return new Promise((resolve, reject) => {
    try {
      let currentAssignment = generateFlexibleInitialAssignment(students, classes);

      if (!validateFlexibleHardConstraints(students, currentAssignment)) {
        reject(
          new Error(
            'Cannot satisfy hard constraints (blacklist and/or must-be-with). Check for conflicting requirements.'
          )
        );
        return;
      }

      let currentEvaluation = evaluateAssignment(
        students,
        classes,
        currentAssignment,
        config,
        'auto_sort'
      );
      let bestAssignment = new Map(currentAssignment);
      let bestEvaluation = currentEvaluation;

      const initialTemperature = 1.0;
      const coolingRate = 0.9995;
      const minTemperature = 0.001;
      let temperature = initialTemperature;

      let iteration = 0;
      const chunkSize = 100;

      const processChunk = () => {
        const chunkEnd = Math.min(iteration + chunkSize, config.maxIterations);

        while (iteration < chunkEnd && temperature > minTemperature) {
          const neighbor = generateFlexibleNeighbor(currentAssignment, students, classes);

          if (validateFlexibleHardConstraints(students, neighbor)) {
            const neighborEvaluation = evaluateAssignment(
              students,
              classes,
              neighbor,
              config,
              'auto_sort'
            );
            const delta = neighborEvaluation.overallScore - currentEvaluation.overallScore;

            if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
              currentAssignment = neighbor;
              currentEvaluation = neighborEvaluation;

              if (currentEvaluation.overallScore > bestEvaluation.overallScore) {
                bestAssignment = new Map(currentAssignment);
                bestEvaluation = currentEvaluation;
              }
            }
          }

          temperature *= coolingRate;
          iteration++;
        }

        onProgress?.((iteration / config.maxIterations) * 100);

        if (iteration < config.maxIterations && temperature > minTemperature) {
          setTimeout(processChunk, 0);
        } else {
          resolve(buildResult(students, classes, bestAssignment, bestEvaluation, iteration, config));
        }
      };

      processChunk();
    } catch (err) {
      reject(err);
    }
  });
}

async function runStrictSorting(
  students: Student[],
  classes: Class[],
  config: SortingConfiguration,
  onProgress?: (progress: number) => void
): Promise<SortingResult> {
  return new Promise((resolve, reject) => {
    try {
      const targetSizes = buildTargetSizes(students.length, classes.length);
      const buckets = targetSizes.map((targetSize, index) => ({
        id: `bucket-${index}`,
        name: `Bucket ${index + 1}`,
        targetSize,
        createdAt: new Date(),
      }));

      let currentAssignment = generateStrictInitialAssignment(students, buckets);
      const initialSizeCompliance = calculateSizeCompliance(buckets, currentAssignment, students.length);
      if (!initialSizeCompliance.isExact) {
        reject(new Error('Strict sizing failed to produce an exact initial class-size split.'));
        return;
      }
      let currentEvaluation = evaluateAssignment(
        students,
        buckets,
        currentAssignment,
        config,
        'auto_sort'
      );
      let bestAssignment = new Map(currentAssignment);
      let bestEvaluation = currentEvaluation;

      const initialTemperature = 1.0;
      const coolingRate = 0.9995;
      const minTemperature = 0.001;
      let temperature = initialTemperature;

      let iteration = 0;
      const chunkSize = 100;

      const processChunk = () => {
        const chunkEnd = Math.min(iteration + chunkSize, config.maxIterations);

        while (iteration < chunkEnd && temperature > minTemperature) {
          const neighbor = generateStrictNeighbor(currentAssignment, students);
          const neighborEvaluation = evaluateAssignment(
            students,
            buckets,
            neighbor,
            config,
            'auto_sort'
          );
          const delta = neighborEvaluation.overallScore - currentEvaluation.overallScore;

          if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
            currentAssignment = neighbor;
            currentEvaluation = neighborEvaluation;

            if (currentEvaluation.overallScore > bestEvaluation.overallScore) {
              bestAssignment = new Map(currentAssignment);
              bestEvaluation = currentEvaluation;
            }
          }

          temperature *= coolingRate;
          iteration++;
        }

        onProgress?.((iteration / config.maxIterations) * 100);

        if (iteration < config.maxIterations && temperature > minTemperature) {
          setTimeout(processChunk, 0);
        } else {
          const mappedAssignment = mapStrictAssignmentToClasses(bestAssignment, classes, buckets);
          const mappedSizeCompliance = calculateSizeCompliance(classes, mappedAssignment, students.length);
          if (!mappedSizeCompliance.isExact) {
            reject(new Error('Strict sizing failed to preserve the exact class-size split.'));
            return;
          }
          const finalEvaluation = evaluateAssignment(
            students,
            classes,
            mappedAssignment,
            config,
            'auto_sort'
          );
          resolve(buildResult(students, classes, mappedAssignment, finalEvaluation, iteration, config));
        }
      };

      processChunk();
    } catch (err) {
      reject(err);
    }
  });
}

function normalizeSortingConfig(config: SortingConfiguration): SortingConfiguration {
  return {
    ...config,
    classSizeMode: config.classSizeMode === 'flexible' ? 'flexible' : 'strict',
    priorityWeights: {
      friendPreference: safeWeight(config.priorityWeights.friendPreference, 0.6),
      classSizeBalance: safeWeight(config.priorityWeights.classSizeBalance, 0.8),
      genderBalance: safeWeight(config.priorityWeights.genderBalance, 0.2),
      ealBalance: safeWeight(config.priorityWeights.ealBalance, 0.2),
      behaviorBalance: safeWeight(config.priorityWeights.behaviorBalance, 0.2),
      abilityBalance: safeWeight(config.priorityWeights.abilityBalance, 0.2),
      ehcpBalance: safeWeight(config.priorityWeights.ehcpBalance, 0.2),
      sendBalance: safeWeight(config.priorityWeights.sendBalance, 0.2),
      ppgBalance: safeWeight(config.priorityWeights.ppgBalance, 0.2),
    },
    maxIterations: Math.max(1000, config.maxIterations || 10000),
  };
}

function safeWeight(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function generateFlexibleInitialAssignment(students: Student[], classes: Class[]): Assignment {
  const assignment = new Map<string, string>();
  const classSizes = new Map<string, number>();
  const targetSizes = buildTargetSizes(students.length, classes.length);
  const targetSizeByClass = new Map(classes.map((cls, index) => [cls.id, targetSizes[index] ?? 0]));
  classes.forEach((cls) => classSizes.set(cls.id, 0));

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const units = buildStudentUnits(students, true).sort((a, b) => {
    const score = (unit: string[]) =>
      unit.reduce((sum, id) => {
        const student = studentMap.get(id);
        if (!student) return sum;
        return (
          sum +
          student.blacklistedStudents.length * 3 +
          student.preferredFriends.length +
          (student.mustBeWithStudentId ? 2 : 0)
        );
      }, 0);
    return score(b) - score(a);
  });

  for (const unit of units) {
    const unitStudents = unit
      .map((id) => studentMap.get(id))
      .filter((student): student is Student => Boolean(student));

    const validClasses = classes.filter((cls) => {
      const classStudents = Array.from(assignment.entries())
        .filter(([, classId]) => classId === cls.id)
        .map(([studentId]) => studentId);

      return unitStudents.every((student) => {
        const hasBlacklistViolation = student.blacklistedStudents.some((blacklistedId) =>
          classStudents.includes(blacklistedId)
        );
        const isBlacklistedByOther = classStudents.some((studentId) => {
          const classmate = studentMap.get(studentId);
          return classmate?.blacklistedStudents.includes(student.id);
        });
        const pairedStudentId = student.mustBeWithStudentId;
        const breaksPair =
          pairedStudentId !== null &&
          assignment.has(pairedStudentId) &&
          assignment.get(pairedStudentId) !== cls.id;

        return !hasBlacklistViolation && !isBlacklistedByOther && !breaksPair;
      });
    });

    const candidateClasses = validClasses.length > 0 ? validClasses : classes;
    const bestClass = candidateClasses.reduce((best, current) => {
      const currentFriends = unitStudents.reduce(
        (sum, student) => sum + countFriendsInClass(student, current.id, assignment),
        0
      );
      const bestFriends = unitStudents.reduce(
        (sum, student) => sum + countFriendsInClass(student, best.id, assignment),
        0
      );
      const currentSize = classSizes.get(current.id) || 0;
      const bestSize = classSizes.get(best.id) || 0;
      const currentTarget = targetSizeByClass.get(current.id) || 0;
      const bestTarget = targetSizeByClass.get(best.id) || 0;
      const currentDeviation = Math.abs(currentSize + unit.length - currentTarget);
      const bestDeviation = Math.abs(bestSize + unit.length - bestTarget);
      const currentOverflow = Math.max(0, currentSize + unit.length - currentTarget);
      const bestOverflow = Math.max(0, bestSize + unit.length - bestTarget);

      if (currentFriends > bestFriends) return current;
      if (currentFriends < bestFriends) return best;
      if (currentOverflow < bestOverflow) return current;
      if (currentOverflow > bestOverflow) return best;
      if (currentDeviation < bestDeviation) return current;
      if (currentDeviation > bestDeviation) return best;
      if (currentSize < bestSize) return current;
      return best;
    });

    unit.forEach((studentId) => assignment.set(studentId, bestClass.id));
    classSizes.set(bestClass.id, (classSizes.get(bestClass.id) || 0) + unit.length);
  }

  return assignment;
}

function generateStrictInitialAssignment(students: Student[], buckets: Class[]): Assignment {
  const assignment = new Map<string, string>();
  const remainingCapacity = new Map<string, number>(
    buckets.map((bucket) => [bucket.id, bucket.targetSize])
  );
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const sortedStudents = [...students].sort((a, b) => {
    const scoreA =
      a.blacklistedStudents.length * 3 +
      a.preferredFriends.length +
      (a.mustBeWithStudentId ? 2 : 0);
    const scoreB =
      b.blacklistedStudents.length * 3 +
      b.preferredFriends.length +
      (b.mustBeWithStudentId ? 2 : 0);
    return scoreB - scoreA;
  });

  for (const student of sortedStudents) {
    const availableBuckets = buckets.filter((bucket) => (remainingCapacity.get(bucket.id) || 0) > 0);
    const [firstBucket, ...otherBuckets] = availableBuckets;
    if (!firstBucket) {
      throw new Error('Strict sizing failed while assigning students to buckets.');
    }

    const bestBucket = otherBuckets.reduce((best, current) => {
        if (!best) return current;

        const bestMetrics = getStrictPlacementMetrics(student, best.id, assignment, studentMap);
        const currentMetrics = getStrictPlacementMetrics(student, current.id, assignment, studentMap);

        if (currentMetrics.blacklistViolations < bestMetrics.blacklistViolations) return current;
        if (currentMetrics.blacklistViolations > bestMetrics.blacklistViolations) return best;
        if (currentMetrics.mustBeWithViolations < bestMetrics.mustBeWithViolations) return current;
        if (currentMetrics.mustBeWithViolations > bestMetrics.mustBeWithViolations) return best;
        if (currentMetrics.friendMatches > bestMetrics.friendMatches) return current;
        if (currentMetrics.friendMatches < bestMetrics.friendMatches) return best;

        return (remainingCapacity.get(current.id) || 0) > (remainingCapacity.get(best.id) || 0)
          ? current
          : best;
      }, firstBucket);

    assignment.set(student.id, bestBucket.id);
    remainingCapacity.set(bestBucket.id, (remainingCapacity.get(bestBucket.id) || 0) - 1);
  }

  return assignment;
}

function getStrictPlacementMetrics(
  student: Student,
  bucketId: string,
  assignment: Assignment,
  studentMap: Map<string, Student>
) {
  let blacklistViolations = 0;
  let mustBeWithViolations = 0;
  let friendMatches = 0;

  assignment.forEach((assignedBucketId, assignedStudentId) => {
    if (assignedBucketId !== bucketId) return;
    const classmate = studentMap.get(assignedStudentId);
    if (!classmate) return;

    if (
      student.blacklistedStudents.includes(assignedStudentId) ||
      classmate.blacklistedStudents.includes(student.id)
    ) {
      blacklistViolations += 1;
    }

    if (
      student.mustBeWithStudentId === assignedStudentId ||
      classmate.mustBeWithStudentId === student.id
    ) {
      friendMatches += 1;
    }

    if (student.preferredFriends.includes(assignedStudentId)) {
      friendMatches += 1;
    }
  });

  if (
    student.mustBeWithStudentId &&
    assignment.has(student.mustBeWithStudentId) &&
    assignment.get(student.mustBeWithStudentId) !== bucketId
  ) {
    mustBeWithViolations += 1;
  }

  return { blacklistViolations, mustBeWithViolations, friendMatches };
}

function validateFlexibleHardConstraints(students: Student[], assignment: Assignment): boolean {
  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    for (const blacklistedId of student.blacklistedStudents) {
      if (assignment.get(blacklistedId) === classId) {
        return false;
      }
    }

    if (student.mustBeWithStudentId && assignment.get(student.mustBeWithStudentId) !== classId) {
      return false;
    }
  }

  return true;
}

function generateFlexibleNeighbor(
  assignment: Assignment,
  students: Student[],
  classes: Class[]
): Assignment {
  const neighbor = new Map(assignment);
  const units = buildStudentUnits(students, true);
  if (units.length === 0 || classes.length === 0) return neighbor;

  const sizeCompliance = calculateSizeCompliance(classes, neighbor, students.length);
  const oversizedClasses = classes
    .filter((cls) => (sizeCompliance.classActualSizes[cls.id] ?? 0) > (sizeCompliance.classTargets[cls.id] ?? 0))
    .map((cls) => cls.id);
  const undersizedClasses = classes
    .filter((cls) => (sizeCompliance.classActualSizes[cls.id] ?? 0) < (sizeCompliance.classTargets[cls.id] ?? 0))
    .map((cls) => cls.id);

  if (Math.random() < 0.5 && units.length > 1) {
    const unitA = units[Math.floor(Math.random() * units.length)];
    const unitB = units[Math.floor(Math.random() * units.length)];
    const classA = assignment.get(unitA[0]);
    const classB = assignment.get(unitB[0]);

    if (classA && classB && classA !== classB) {
      unitA.forEach((studentId) => neighbor.set(studentId, classB));
      unitB.forEach((studentId) => neighbor.set(studentId, classA));
    }
    return neighbor;
  }

  const moveCandidates = units.filter((unit) => {
    const classId = assignment.get(unit[0]);
    return classId && (oversizedClasses.includes(classId) || oversizedClasses.length === 0);
  });
  const unit = moveCandidates[Math.floor(Math.random() * moveCandidates.length)] ?? units[0];
  const targetClassIds = undersizedClasses.length > 0 ? undersizedClasses : classes.map((cls) => cls.id);
  const availableTargetClassIds = targetClassIds.filter((classId) => classId !== assignment.get(unit[0]));
  const newClassId =
    availableTargetClassIds[Math.floor(Math.random() * availableTargetClassIds.length)] ??
    classes[Math.floor(Math.random() * classes.length)]?.id;

  if (newClassId) {
    unit.forEach((studentId) => neighbor.set(studentId, newClassId));
  }

  return neighbor;
}

function generateStrictNeighbor(assignment: Assignment, students: Student[]): Assignment {
  const neighbor = new Map(assignment);
  if (students.length < 2) return neighbor;

  const firstStudent = students[Math.floor(Math.random() * students.length)];
  const firstClassId = assignment.get(firstStudent.id);
  if (!firstClassId) return neighbor;

  const swapCandidates = students.filter((student) => assignment.get(student.id) !== firstClassId);
  if (swapCandidates.length === 0) return neighbor;

  const secondStudent = swapCandidates[Math.floor(Math.random() * swapCandidates.length)];
  const secondClassId = assignment.get(secondStudent.id);
  if (!secondClassId) return neighbor;

  neighbor.set(firstStudent.id, secondClassId);
  neighbor.set(secondStudent.id, firstClassId);
  return neighbor;
}

function mapStrictAssignmentToClasses(
  assignment: Assignment,
  classes: Class[],
  buckets: Class[]
): Assignment {
  const bucketToClass = new Map<string, string>();
  buckets
    .slice()
    .sort((a, b) => a.targetSize - b.targetSize)
    .forEach((bucket, index) => {
      const cls = classes[index];
      if (cls) {
        bucketToClass.set(bucket.id, cls.id);
      }
    });

  const mapped = new Map<string, string>();
  assignment.forEach((bucketId, studentId) => {
    const classId = bucketToClass.get(bucketId);
    if (classId) {
      mapped.set(studentId, classId);
    }
  });

  return mapped;
}

function buildStudentUnits(students: Student[], pairMustBeWith: boolean): string[][] {
  if (!pairMustBeWith) {
    return students.map((student) => [student.id]);
  }

  const visited = new Set<string>();
  const units: string[][] = [];

  for (const student of students) {
    if (visited.has(student.id)) continue;

    const partnerId = student.mustBeWithStudentId;
    if (partnerId) {
      const partner = students.find((candidate) => candidate.id === partnerId);
      if (partner?.mustBeWithStudentId === student.id) {
        visited.add(student.id);
        visited.add(partner.id);
        units.push([student.id, partner.id]);
        continue;
      }
    }

    visited.add(student.id);
    units.push([student.id]);
  }

  return units;
}

function countFriendsInClass(student: Student, classId: string, assignment: Assignment): number {
  return student.preferredFriends.filter((friendId) => assignment.get(friendId) === classId).length;
}

function evaluateAssignment(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  config: SortingConfiguration,
  scope: 'auto_sort' | 'manual_edit'
): EvaluationResult {
  const sizeCompliance = calculateSizeCompliance(classes, assignment, students.length);
  const violations = collectConstraintViolations(
    students,
    classes,
    assignment,
    config.classSizeMode,
    scope,
    sizeCompliance
  );
  const blacklistCount = violations.filter((violation) => violation.type === 'blacklist').length;
  const mustBeWithCount = violations.filter((violation) => violation.type === 'must_be_with').length;
  const softScore = calculateSoftScore(students, classes, assignment, config, sizeCompliance);
  const overallScore =
    -blacklistCount * BLACKLIST_PENALTY - mustBeWithCount * MUST_BE_WITH_PENALTY + softScore;

  return {
    violations,
    blacklistCount,
    mustBeWithCount,
    softScore,
    overallScore,
    sizeCompliance,
  };
}

export function collectConstraintViolations(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  classSizeMode: ClassSizeMode,
  scope: 'auto_sort' | 'manual_edit',
  sizeCompliance = calculateSizeCompliance(classes, assignment, students.length)
): ConstraintViolation[] {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const classMap = new Map(classes.map((cls) => [cls.id, cls]));
  const violations: ConstraintViolation[] = [];

  const seenBlacklistPairs = new Set<string>();
  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    for (const relatedStudentId of student.blacklistedStudents) {
      const relatedClassId = assignment.get(relatedStudentId);
      if (!relatedClassId || relatedClassId !== classId) continue;

      const key = ['blacklist', student.id, relatedStudentId].sort().join(':');
      if (seenBlacklistPairs.has(key)) continue;
      seenBlacklistPairs.add(key);

      const relatedStudent = studentMap.get(relatedStudentId);
      const cls = classMap.get(classId);
      violations.push({
        type: 'blacklist',
        scope,
        severity: 'hard',
        studentId: student.id,
        studentName: student.name,
        relatedStudentId,
        relatedStudentName: relatedStudent?.name,
        classId,
        className: cls?.name,
        message: `${student.name} and ${relatedStudent?.name || 'Unknown'} are blacklisted but assigned together.`,
      });
    }
  }

  const seenMustPairs = new Set<string>();
  for (const student of students) {
    const relatedStudentId = student.mustBeWithStudentId;
    if (!relatedStudentId) continue;

    const key = ['must', student.id, relatedStudentId].sort().join(':');
    if (seenMustPairs.has(key)) continue;
    seenMustPairs.add(key);

    const classId = assignment.get(student.id);
    const relatedClassId = assignment.get(relatedStudentId);
    if (!classId || !relatedClassId || classId === relatedClassId) continue;

    const relatedStudent = studentMap.get(relatedStudentId);
    violations.push({
      type: 'must_be_with',
      scope,
      severity: 'hard',
      studentId: student.id,
      studentName: student.name,
      relatedStudentId,
      relatedStudentName: relatedStudent?.name,
      classId,
      className: classMap.get(classId)?.name,
      relatedClassId,
      relatedClassName: classMap.get(relatedClassId)?.name,
      message: `${student.name} and ${relatedStudent?.name || 'Unknown'} should be together but are separated.`,
    });
  }

  const classSizeThreshold = classSizeMode === 'strict' ? 0 : FLEXIBLE_SIZE_WARNING_THRESHOLD;
  classes.forEach((cls) => {
    const deviation = sizeCompliance.classDeviations[cls.id] ?? 0;
    if (deviation <= classSizeThreshold) return;

    violations.push({
      type: 'class_size',
      scope,
      severity: 'warning',
      studentId: cls.id,
      classId: cls.id,
      className: cls.name,
      message: `${cls.name} has ${sizeCompliance.classActualSizes[cls.id] ?? 0} students, target ${
        sizeCompliance.classTargets[cls.id] ?? 0
      }.`,
    });
  });

  return violations;
}

function calculateSoftScore(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  config: SortingConfiguration,
  sizeCompliance: SizeCompliance
): number {
  const weights = config.priorityWeights;
  let score = 0;

  let friendScore = 0;
  let maxFriendScore = 0;
  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const friendsInClass = student.preferredFriends.filter(
      (friendId) => assignment.get(friendId) === classId
    ).length;

    friendScore += friendsInClass;
    maxFriendScore += student.preferredFriends.length;
  }
  const normalizedFriendScore = maxFriendScore > 0 ? friendScore / maxFriendScore : 1;
  score += weights.friendPreference * normalizedFriendScore;

  if (config.classSizeMode === 'flexible') {
    score += weights.classSizeBalance * calculateClassSizeScore(sizeCompliance, students.length);
  }

  score += weights.genderBalance * calculateGenderBalance(students, classes, assignment);
  score += weights.ealBalance * calculateEALBalance(students, classes, assignment);
  score += weights.behaviorBalance * calculateRankBalance(students, classes, assignment, 'behavior');
  score += weights.abilityBalance * calculateRankBalance(students, classes, assignment, 'ability');
  score += weights.ehcpBalance * calculateBooleanBalance(students, classes, assignment, 'ehcp');
  score += weights.sendBalance * calculateBooleanBalance(students, classes, assignment, 'send');
  score += weights.ppgBalance * calculateBooleanBalance(students, classes, assignment, 'ppg');

  return score;
}

function calculateClassSizeScore(sizeCompliance: SizeCompliance, totalStudents: number): number {
  const sortedTargets = [...sizeCompliance.targetSizes].sort((a, b) => a - b);
  const sortedActuals = [...sizeCompliance.actualSizes].sort((a, b) => a - b);
  const totalDeviation = sortedTargets.reduce(
    (sum, target, index) => sum + Math.abs(target - (sortedActuals[index] ?? 0)),
    0
  );

  return Math.max(0, 1 - totalDeviation / Math.max(totalStudents, 1));
}

function calculateGenderBalance(
  students: Student[],
  classes: Class[],
  assignment: Assignment
): number {
  const classCounts = new Map<string, { male: number; female: number; total: number }>();

  for (const cls of classes) {
    classCounts.set(cls.id, { male: 0, female: 0, total: 0 });
  }

  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const counts = classCounts.get(classId);
    if (counts) {
      counts.total++;
      if (student.gender === 'male') counts.male++;
      else counts.female++;
    }
  }

  const ratios = Array.from(classCounts.values())
    .filter((counts) => counts.total > 0)
    .map((counts) => counts.male / counts.total);

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
  return Math.max(0, 1 - variance * 4);
}

function calculateEALBalance(
  students: Student[],
  classes: Class[],
  assignment: Assignment
): number {
  const classCounts = new Map<string, { eal: number; total: number }>();
  for (const cls of classes) {
    classCounts.set(cls.id, { eal: 0, total: 0 });
  }

  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const counts = classCounts.get(classId);
    if (counts) {
      counts.total++;
      if (student.isEAL) counts.eal++;
    }
  }

  const ratios = Array.from(classCounts.values())
    .filter((counts) => counts.total > 0)
    .map((counts) => counts.eal / counts.total);

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
  return Math.max(0, 1 - variance * 4);
}

function calculateRankBalance(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  field: 'behavior' | 'ability'
): number {
  const classStats = new Map<string, { sum: number; total: number }>();
  for (const cls of classes) {
    classStats.set(cls.id, { sum: 0, total: 0 });
  }

  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const stats = classStats.get(classId);
    if (stats) {
      stats.total++;
      stats.sum += student[field];
    }
  }

  const means = Array.from(classStats.values())
    .filter((stats) => stats.total > 0)
    .map((stats) => stats.sum / stats.total);

  if (means.length === 0) return 1;

  const mean = means.reduce((sum, value) => sum + value, 0) / means.length;
  const variance = means.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / means.length;
  return Math.max(0, 1 - variance);
}

function calculateBooleanBalance(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  field: 'ehcp' | 'send' | 'ppg'
): number {
  const classCounts = new Map<string, { matching: number; total: number }>();
  for (const cls of classes) {
    classCounts.set(cls.id, { matching: 0, total: 0 });
  }

  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const counts = classCounts.get(classId);
    if (counts) {
      counts.total++;
      if (student[field]) counts.matching++;
    }
  }

  const ratios = Array.from(classCounts.values())
    .filter((counts) => counts.total > 0)
    .map((counts) => counts.matching / counts.total);

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
  return Math.max(0, 1 - variance * 4);
}

function buildResult(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  evaluation: EvaluationResult,
  iterations: number,
  config: SortingConfiguration
): SortingResult {
  const assignments: Record<string, string> = {};
  assignment.forEach((classId, studentId) => {
    assignments[studentId] = classId;
  });

  const classStatistics: ClassStatistics[] = classes.map((cls) => {
    const classStudents = students.filter((student) => assignment.get(student.id) === cls.id);
    const studentSatisfaction = classStudents.map((student) =>
      calculateStudentSatisfaction(student, cls.id, students)
    );
    const totalSatisfaction = studentSatisfaction.reduce((sum, satisfaction) => sum + satisfaction.score, 0);
    const avgSatisfaction = classStudents.length > 0 ? totalSatisfaction / classStudents.length : 100;

    return {
      classId: cls.id,
      className: cls.name,
      totalStudents: classStudents.length,
      genderDistribution: {
        male: classStudents.filter((student) => student.gender === 'male').length,
        female: classStudents.filter((student) => student.gender === 'female').length,
      },
      ealCount: classStudents.filter((student) => student.isEAL).length,
      ealPercentage:
        classStudents.length > 0
          ? (classStudents.filter((student) => student.isEAL).length / classStudents.length) * 100
          : 0,
      averageSatisfaction: avgSatisfaction,
      studentSatisfaction,
    };
  });

  const allSatisfaction = classStatistics.flatMap((classStat) => classStat.studentSatisfaction);
  const overallSatisfaction =
    allSatisfaction.length > 0
      ? allSatisfaction.reduce((sum, satisfaction) => sum + satisfaction.score, 0) / allSatisfaction.length
      : 100;

  return {
    assignments,
    overallSatisfaction,
    iterationsUsed: iterations,
    classStatistics,
    classSizeMode: config.classSizeMode,
    violations: evaluation.violations,
    sizeCompliance: evaluation.sizeCompliance,
    strictOverrideApplied:
      config.classSizeMode === 'strict' &&
      evaluation.violations.some(
        (violation) => violation.type === 'blacklist' || violation.type === 'must_be_with'
      ),
  };
}

export function buildAssignmentFromStudents(students: Student[]): Assignment {
  const assignment = new Map<string, string>();
  students.forEach((student) => {
    if (student.assignedClassId) {
      assignment.set(student.id, student.assignedClassId);
    }
  });
  return assignment;
}

export function getAssignmentInsights(
  students: Student[],
  classes: Class[],
  classSizeMode: ClassSizeMode,
  scope: 'auto_sort' | 'manual_edit' = 'manual_edit'
) {
  const assignment = buildAssignmentFromStudents(students);
  const sizeCompliance = calculateSizeCompliance(classes, assignment, students.length);
  const violations = collectConstraintViolations(
    students,
    classes,
    assignment,
    classSizeMode,
    scope,
    sizeCompliance
  );

  return {
    sizeCompliance,
    violations,
    blacklistViolations: violations.filter((violation) => violation.type === 'blacklist'),
    mustBeWithViolations: violations.filter((violation) => violation.type === 'must_be_with'),
    classSizeViolations: violations.filter((violation) => violation.type === 'class_size'),
  };
}

export function calculateStudentSatisfaction(
  student: Student,
  classId: string,
  allStudents: Student[]
): SatisfactionScore {
  const classmates = allStudents.filter(
    (candidate) => candidate.assignedClassId === classId && candidate.id !== student.id
  );
  const classmateIds = classmates.map((classmate) => classmate.id);

  const friendsInClass = student.preferredFriends.filter((friendId) => classmateIds.includes(friendId));
  const maxFriends = student.preferredFriends.length;
  const score = maxFriends > 0 ? (friendsInClass.length / maxFriends) * 100 : 100;

  const hasBlacklistViolation = student.blacklistedStudents.some((blacklistedId) =>
    classmateIds.includes(blacklistedId)
  );
  const hasMustBeWithViolation = Boolean(
    student.mustBeWithStudentId &&
      !classmateIds.includes(student.mustBeWithStudentId) &&
      allStudents.some((candidate) => candidate.id === student.mustBeWithStudentId)
  );

  return {
    studentId: student.id,
    score,
    preferredFriendsInClass: friendsInClass.length,
    maxPossibleFriends: maxFriends,
    friendsMatched: friendsInClass,
    hasBlacklistViolation,
    hasMustBeWithViolation,
  };
}
