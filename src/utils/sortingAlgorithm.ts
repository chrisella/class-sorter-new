import type { Student, Class, SortingConfiguration, SortingResult, ClassStatistics, SatisfactionScore } from '../types';

type Assignment = Map<string, string>; // studentId -> classId

export async function runSorting(
  students: Student[],
  classes: Class[],
  config: SortingConfiguration,
  onProgress?: (progress: number) => void
): Promise<SortingResult> {
  return new Promise((resolve, reject) => {
    try {
      // Generate initial assignment using greedy algorithm
      let currentAssignment = generateInitialAssignment(students, classes);

      // Validate hard constraints
      if (!validateHardConstraints(students, currentAssignment)) {
        reject(new Error('Cannot satisfy all blacklist constraints. Check for conflicting requirements.'));
        return;
      }

      // Optimize using simulated annealing
      let currentScore = calculateScore(students, classes, currentAssignment, config);
      let bestAssignment = new Map(currentAssignment);
      let bestScore = currentScore;

      const initialTemperature = 1.0;
      const coolingRate = 0.9995;
      const minTemperature = 0.001;
      let temperature = initialTemperature;

      // Process in chunks to avoid blocking the UI
      let iteration = 0;
      const chunkSize = 100;

      const processChunk = () => {
        const chunkEnd = Math.min(iteration + chunkSize, config.maxIterations);

        while (iteration < chunkEnd && temperature > minTemperature) {
          // Generate neighbor solution
          const neighbor = generateNeighbor(currentAssignment, students, classes);

          // Skip if neighbor violates hard constraints
          if (validateHardConstraints(students, neighbor)) {
            const neighborScore = calculateScore(students, classes, neighbor, config);
            const delta = neighborScore - currentScore;

            // Accept if better or probabilistically accept if worse
            if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
              currentAssignment = neighbor;
              currentScore = neighborScore;

              if (currentScore > bestScore) {
                bestAssignment = new Map(currentAssignment);
                bestScore = currentScore;
              }
            }
          }

          temperature *= coolingRate;
          iteration++;
        }

        // Report progress
        const progress = (iteration / config.maxIterations) * 100;
        onProgress?.(progress);

        if (iteration < config.maxIterations && temperature > minTemperature) {
          // Continue processing
          setTimeout(processChunk, 0);
        } else {
          // Done - build result
          const result = buildResult(students, classes, bestAssignment, bestScore, iteration);
          resolve(result);
        }
      };

      // Start processing
      processChunk();
    } catch (err) {
      reject(err);
    }
  });
}

function generateInitialAssignment(students: Student[], classes: Class[]): Assignment {
  const assignment = new Map<string, string>();
  const classSizes = new Map<string, number>();
  classes.forEach((c) => classSizes.set(c.id, 0));

  // Sort students by constraint complexity (most constrained first)
  const sortedStudents = [...students].sort(
    (a, b) =>
      b.blacklistedStudents.length +
      b.preferredFriends.length -
      (a.blacklistedStudents.length + a.preferredFriends.length)
  );

  for (const student of sortedStudents) {
    // Find valid classes (no blacklist violations)
    const validClasses = classes.filter((c) => {
      const classStudents = Array.from(assignment.entries())
        .filter(([, cId]) => cId === c.id)
        .map(([sId]) => sId);

      // Check if any blacklisted student is in this class
      const hasBlacklistViolation = student.blacklistedStudents.some((bId) =>
        classStudents.includes(bId)
      );

      // Check if student is blacklisted by anyone in this class
      const isBlacklistedByOther = classStudents.some((sId) => {
        const s = students.find((st) => st.id === sId);
        return s?.blacklistedStudents.includes(student.id);
      });

      return !hasBlacklistViolation && !isBlacklistedByOther;
    });

    if (validClasses.length === 0) {
      // Fallback: assign to class with fewest students
      const [minClass] = classes.sort(
        (a, b) => (classSizes.get(a.id) || 0) - (classSizes.get(b.id) || 0)
      );
      assignment.set(student.id, minClass.id);
      classSizes.set(minClass.id, (classSizes.get(minClass.id) || 0) + 1);
      continue;
    }

    // Choose class that maximizes friend count, then balances size
    const bestClass = validClasses.reduce((best, current) => {
      const currentFriends = countFriendsInClass(student, current.id, assignment);
      const bestFriends = countFriendsInClass(student, best.id, assignment);
      const currentSize = classSizes.get(current.id) || 0;
      const bestSize = classSizes.get(best.id) || 0;

      // Prefer class with more friends, then smaller size
      if (currentFriends > bestFriends) return current;
      if (currentFriends < bestFriends) return best;
      if (currentSize < bestSize) return current;
      return best;
    });

    assignment.set(student.id, bestClass.id);
    classSizes.set(bestClass.id, (classSizes.get(bestClass.id) || 0) + 1);
  }

  return assignment;
}

function countFriendsInClass(student: Student, classId: string, assignment: Assignment): number {
  return student.preferredFriends.filter((fId) => assignment.get(fId) === classId).length;
}

function validateHardConstraints(students: Student[], assignment: Assignment): boolean {
  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    // Check if any blacklisted student is in the same class
    for (const blacklistedId of student.blacklistedStudents) {
      if (assignment.get(blacklistedId) === classId) {
        return false;
      }
    }
  }
  return true;
}

function generateNeighbor(assignment: Assignment, _students: Student[], classes: Class[]): Assignment {
  const neighbor = new Map(assignment);
  const studentIds = Array.from(assignment.keys());

  if (Math.random() < 0.7) {
    // Swap two students from different classes
    const s1 = studentIds[Math.floor(Math.random() * studentIds.length)];
    const s2 = studentIds[Math.floor(Math.random() * studentIds.length)];

    if (assignment.get(s1) !== assignment.get(s2)) {
      const c1 = assignment.get(s1)!;
      const c2 = assignment.get(s2)!;
      neighbor.set(s1, c2);
      neighbor.set(s2, c1);
    }
  } else {
    // Move single student to different class
    const student = studentIds[Math.floor(Math.random() * studentIds.length)];
    const newClass = classes[Math.floor(Math.random() * classes.length)];
    neighbor.set(student, newClass.id);
  }

  return neighbor;
}

function calculateScore(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  config: SortingConfiguration
): number {
  const weights = config.priorityWeights;
  let score = 0;

  // Friend satisfaction score (normalized 0-1)
  let friendScore = 0;
  let maxFriendScore = 0;
  for (const student of students) {
    const classId = assignment.get(student.id);
    if (!classId) continue;

    const friendsInClass = student.preferredFriends.filter(
      (fId) => assignment.get(fId) === classId
    ).length;

    friendScore += friendsInClass;
    maxFriendScore += student.preferredFriends.length;
  }
  const normalizedFriendScore = maxFriendScore > 0 ? friendScore / maxFriendScore : 1;
  score += weights.friendPreference * normalizedFriendScore;

  // Gender balance score (lower variance = higher score)
  const genderBalance = calculateGenderBalance(students, classes, assignment);
  score += weights.genderBalance * genderBalance;

  // EAL balance score
  const ealBalance = calculateEALBalance(students, classes, assignment);
  score += weights.ealBalance * ealBalance;

  // Behavior and ability mean balance scores
  const behaviorBalance = calculateRankBalance(students, classes, assignment, 'behavior');
  score += weights.behaviorBalance * behaviorBalance;
  const abilityBalance = calculateRankBalance(students, classes, assignment, 'ability');
  score += weights.abilityBalance * abilityBalance;

  // EHCP/SEND/PPG ratio balance scores
  const ehcpBalance = calculateBooleanBalance(students, classes, assignment, 'ehcp');
  score += weights.ehcpBalance * ehcpBalance;
  const sendBalance = calculateBooleanBalance(students, classes, assignment, 'send');
  score += weights.sendBalance * sendBalance;
  const ppgBalance = calculateBooleanBalance(students, classes, assignment, 'ppg');
  score += weights.ppgBalance * ppgBalance;

  return score;
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

  // Calculate variance of male ratio across classes
  const ratios: number[] = [];
  for (const counts of classCounts.values()) {
    if (counts.total > 0) {
      ratios.push(counts.male / counts.total);
    }
  }

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;

  // Convert variance to score (0 variance = 1, high variance = 0)
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

  // Calculate variance of EAL ratio across classes
  const ratios: number[] = [];
  for (const counts of classCounts.values()) {
    if (counts.total > 0) {
      ratios.push(counts.eal / counts.total);
    }
  }

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;

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

  const means: number[] = [];
  for (const stats of classStats.values()) {
    if (stats.total > 0) {
      means.push(stats.sum / stats.total);
    }
  }

  if (means.length === 0) return 1;

  const mean = means.reduce((a, b) => a + b, 0) / means.length;
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

  const ratios: number[] = [];
  for (const counts of classCounts.values()) {
    if (counts.total > 0) {
      ratios.push(counts.matching / counts.total);
    }
  }

  if (ratios.length === 0) return 1;

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((sum, ratio) => sum + Math.pow(ratio - mean, 2), 0) / ratios.length;
  return Math.max(0, 1 - variance * 4);
}

function buildResult(
  students: Student[],
  classes: Class[],
  assignment: Assignment,
  _score: number,
  iterations: number
): SortingResult {
  // Convert assignment map to record
  const assignments: Record<string, string> = {};
  assignment.forEach((classId, studentId) => {
    assignments[studentId] = classId;
  });

  // Calculate class statistics
  const classStatistics: ClassStatistics[] = classes.map((cls) => {
    const classStudents = students.filter((s) => assignment.get(s.id) === cls.id);

    const studentSatisfaction: SatisfactionScore[] = classStudents.map((student) => {
      const friendsInClass = student.preferredFriends.filter(
        (fId) => assignment.get(fId) === cls.id
      );
      const maxFriends = student.preferredFriends.length;
      const satisfactionScore = maxFriends > 0 ? (friendsInClass.length / maxFriends) * 100 : 100;

      const hasBlacklistViolation = student.blacklistedStudents.some(
        (bId) => assignment.get(bId) === cls.id
      );

      return {
        studentId: student.id,
        score: satisfactionScore,
        preferredFriendsInClass: friendsInClass.length,
        maxPossibleFriends: maxFriends,
        friendsMatched: friendsInClass,
        hasBlacklistViolation,
      };
    });

    const totalSatisfaction = studentSatisfaction.reduce((sum, s) => sum + s.score, 0);
    const avgSatisfaction = classStudents.length > 0 ? totalSatisfaction / classStudents.length : 100;

    return {
      classId: cls.id,
      className: cls.name,
      totalStudents: classStudents.length,
      genderDistribution: {
        male: classStudents.filter((s) => s.gender === 'male').length,
        female: classStudents.filter((s) => s.gender === 'female').length,
      },
      ealCount: classStudents.filter((s) => s.isEAL).length,
      ealPercentage:
        classStudents.length > 0
          ? (classStudents.filter((s) => s.isEAL).length / classStudents.length) * 100
          : 0,
      averageSatisfaction: avgSatisfaction,
      studentSatisfaction,
    };
  });

  // Calculate overall satisfaction
  const allSatisfaction = classStatistics.flatMap((cs) => cs.studentSatisfaction);
  const overallSatisfaction =
    allSatisfaction.length > 0
      ? allSatisfaction.reduce((sum, s) => sum + s.score, 0) / allSatisfaction.length
      : 100;

  return {
    assignments,
    overallSatisfaction,
    iterationsUsed: iterations,
    classStatistics,
  };
}

export function calculateStudentSatisfaction(
  student: Student,
  classId: string,
  allStudents: Student[]
): SatisfactionScore {
  const classmates = allStudents.filter((s) => s.assignedClassId === classId && s.id !== student.id);
  const classmateIds = classmates.map((s) => s.id);

  const friendsInClass = student.preferredFriends.filter((fId) => classmateIds.includes(fId));
  const maxFriends = student.preferredFriends.length;
  const score = maxFriends > 0 ? (friendsInClass.length / maxFriends) * 100 : 100;

  const hasBlacklistViolation = student.blacklistedStudents.some((bId) =>
    classmateIds.includes(bId)
  );

  return {
    studentId: student.id,
    score,
    preferredFriendsInClass: friendsInClass.length,
    maxPossibleFriends: maxFriends,
    friendsMatched: friendsInClass,
    hasBlacklistViolation,
  };
}
