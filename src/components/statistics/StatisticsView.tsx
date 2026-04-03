import { useMemo } from 'react';
import { useClassStore, useStudentStore } from '../../stores';
import { calculateStudentSatisfaction, getAssignmentInsights } from '../../utils/sortingAlgorithm';

export function StatisticsView() {
  const { classes, lastSortingResult, sortingConfig } = useClassStore();
  const { students } = useStudentStore();

  const assignedStudents = students.filter((student) => student.assignedClassId !== null);
  const activeClassSizeMode = lastSortingResult?.classSizeMode ?? sortingConfig.classSizeMode;

  const statistics = useMemo(() => {
    if (assignedStudents.length === 0) return null;

    const insights = getAssignmentInsights(students, classes, activeClassSizeMode, 'manual_edit');
    const satisfactionScores = assignedStudents.map((student) =>
      calculateStudentSatisfaction(student, student.assignedClassId!, students)
    );
    const avgSatisfaction =
      satisfactionScores.reduce((sum, score) => sum + score.score, 0) / satisfactionScores.length;

    const satisfactionDistribution = {
      excellent: satisfactionScores.filter((score) => score.score >= 80).length,
      good: satisfactionScores.filter((score) => score.score >= 40 && score.score < 80).length,
      poor: satisfactionScores.filter((score) => score.score < 40).length,
    };

    const classStats = classes.map((cls) => {
      const classStudents = students.filter((student) => student.assignedClassId === cls.id);
      const classSatisfaction = classStudents.map((student) =>
        calculateStudentSatisfaction(student, cls.id, students)
      );

      return {
        id: cls.id,
        name: cls.name,
        teacherName: cls.teacherName,
        total: classStudents.length,
        target: insights.sizeCompliance.classTargets[cls.id] ?? cls.targetSize,
        deviation: insights.sizeCompliance.classDeviations[cls.id] ?? 0,
        male: classStudents.filter((student) => student.gender === 'male').length,
        female: classStudents.filter((student) => student.gender === 'female').length,
        eal: classStudents.filter((student) => student.isEAL).length,
        ehcp: classStudents.filter((student) => student.ehcp).length,
        send: classStudents.filter((student) => student.send).length,
        ppg: classStudents.filter((student) => student.ppg).length,
        avgSatisfaction:
          classSatisfaction.length > 0
            ? classSatisfaction.reduce((sum, score) => sum + score.score, 0) / classSatisfaction.length
            : 100,
      };
    });

    const pairMap = new Set<string>();
    let totalMustWithPairs = 0;
    let satisfiedMustWithPairs = 0;
    for (const student of students) {
      const partnerId = student.mustBeWithStudentId;
      if (!partnerId) continue;
      const key = [student.id, partnerId].sort().join(':');
      if (pairMap.has(key)) continue;
      pairMap.add(key);
      totalMustWithPairs++;

      const partner = students.find((candidate) => candidate.id === partnerId);
      if (
        partner &&
        student.assignedClassId &&
        partner.assignedClassId &&
        student.assignedClassId === partner.assignedClassId
      ) {
        satisfiedMustWithPairs++;
      }
    }

    return {
      insights,
      avgSatisfaction,
      satisfactionDistribution,
      classStats,
      totalStudents: assignedStudents.length,
      totalMale: assignedStudents.filter((student) => student.gender === 'male').length,
      totalFemale: assignedStudents.filter((student) => student.gender === 'female').length,
      totalEAL: assignedStudents.filter((student) => student.isEAL).length,
      totalEHCP: assignedStudents.filter((student) => student.ehcp).length,
      totalSEND: assignedStudents.filter((student) => student.send).length,
      totalPPG: assignedStudents.filter((student) => student.ppg).length,
      totalMustWithPairs,
      satisfiedMustWithPairs,
      brokenMustWithPairs: totalMustWithPairs - satisfiedMustWithPairs,
    };
  }, [assignedStudents, students, classes, activeClassSizeMode]);

  if (!statistics) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No statistics available</h3>
        <p className="mt-1 text-sm text-gray-500">
          Run the sorting algorithm first to see statistics.
        </p>
      </div>
    );
  }

  const {
    insights,
    avgSatisfaction,
    satisfactionDistribution,
    classStats,
    totalStudents,
    totalMale,
    totalFemale,
    totalEAL,
    totalEHCP,
    totalSEND,
    totalPPG,
    totalMustWithPairs,
    satisfiedMustWithPairs,
    brokenMustWithPairs,
  } = statistics;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Statistics Overview</h2>
        <p className="text-sm text-gray-500">
          Summary of class assignments, violations, and class-size compliance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Overall Satisfaction</p>
          <p className="text-2xl font-bold text-gray-900">{avgSatisfaction.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Target Split</p>
          <p className="text-2xl font-bold text-gray-900">{insights.sizeCompliance.targetSizes.join('/')}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Size Status</p>
          <p
            className={`text-2xl font-bold ${
              insights.sizeCompliance.isExact ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {insights.sizeCompliance.isExact ? 'Exact' : `±${insights.sizeCompliance.maxDeviation}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Blacklist Violations</p>
          <p
            className={`text-2xl font-bold ${
              insights.blacklistViolations.length > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {insights.blacklistViolations.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Must-With Violations</p>
          <p
            className={`text-2xl font-bold ${
              insights.mustBeWithViolations.length > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {insights.mustBeWithViolations.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Size Warning Classes</p>
          <p
            className={`text-2xl font-bold ${
              insights.classSizeViolations.length > 0 ? 'text-amber-600' : 'text-green-600'
            }`}
          >
            {insights.classSizeViolations.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Classes</p>
          <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Male</p>
          <p className="text-2xl font-bold text-gray-900">{totalMale}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Female</p>
          <p className="text-2xl font-bold text-gray-900">{totalFemale}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">EAL</p>
          <p className="text-2xl font-bold text-gray-900">{totalEAL}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">EHCP</p>
          <p className="text-2xl font-bold text-gray-900">{totalEHCP}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">SEND / PPG</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalSEND} / {totalPPG}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Must-With Pairs</p>
          <p className="text-2xl font-bold text-gray-900">{totalMustWithPairs}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Must-With Satisfied</p>
          <p className="text-2xl font-bold text-green-700">{satisfiedMustWithPairs}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Must-With Broken</p>
          <p className="text-2xl font-bold text-red-700">{brokenMustWithPairs}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Satisfaction Distribution</h3>
        <div className="space-y-3">
          <DistributionRow
            label="Excellent (80-100%)"
            color="bg-green-500"
            textColor="text-green-700"
            count={satisfactionDistribution.excellent}
            total={totalStudents}
          />
          <DistributionRow
            label="Good (40-79%)"
            color="bg-yellow-500"
            textColor="text-yellow-700"
            count={satisfactionDistribution.good}
            total={totalStudents}
          />
          <DistributionRow
            label="Needs Attention (0-39%)"
            color="bg-orange-500"
            textColor="text-orange-700"
            count={satisfactionDistribution.poor}
            total={totalStudents}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Class Compliance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deviation</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">EAL</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">EHCP</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">SEND</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">PPG</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Satisfaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classStats.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    {cls.name}
                    {cls.teacherName && <span className="ml-1 text-gray-400">({cls.teacherName})</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.total}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.target}</td>
                  <td
                    className={`px-4 py-2 text-sm text-right ${
                      cls.deviation === 0
                        ? 'text-green-600'
                        : activeClassSizeMode === 'strict' || cls.deviation > 1
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {cls.deviation}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.eal}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.ehcp}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.send}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.ppg}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                    {cls.avgSatisfaction.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lastSortingResult && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          <p>Sorting completed in {lastSortingResult.iterationsUsed.toLocaleString()} iterations.</p>
          <p className="mt-1">
            Auto-sort mode: <span className="capitalize">{lastSortingResult.classSizeMode}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function DistributionRow({
  label,
  color,
  textColor,
  count,
  total,
}: {
  label: string;
  color: string;
  textColor: string;
  count: number;
  total: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className={textColor}>{label}</span>
        <span className="text-gray-600">{count} students</span>
      </div>
      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
