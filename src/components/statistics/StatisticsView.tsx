import { useMemo } from 'react';
import { useClassStore, useStudentStore } from '../../stores';
import { calculateStudentSatisfaction } from '../../utils/sortingAlgorithm';

export function StatisticsView() {
  const { classes, lastSortingResult } = useClassStore();
  const { students } = useStudentStore();

  const assignedStudents = students.filter((s) => s.assignedClassId !== null);

  const statistics = useMemo(() => {
    if (assignedStudents.length === 0) return null;

    // Calculate satisfaction for all students
    const satisfactionScores = assignedStudents.map((student) => {
      return calculateStudentSatisfaction(student, student.assignedClassId!, students);
    });

    const avgSatisfaction =
      satisfactionScores.reduce((sum, s) => sum + s.score, 0) / satisfactionScores.length;

    const satisfactionDistribution = {
      excellent: satisfactionScores.filter((s) => s.score >= 80).length,
      good: satisfactionScores.filter((s) => s.score >= 40 && s.score < 80).length,
      poor: satisfactionScores.filter((s) => s.score < 40).length,
      violations: satisfactionScores.filter((s) => s.hasBlacklistViolation).length,
    };

    // Per-class statistics
    const classStats = classes.map((cls) => {
      const classStudents = students.filter((s) => s.assignedClassId === cls.id);
      const classSatisfaction = classStudents.map((s) =>
        calculateStudentSatisfaction(s, cls.id, students)
      );

      return {
        id: cls.id,
        name: cls.name,
        teacherName: cls.teacherName,
        total: classStudents.length,
        male: classStudents.filter((s) => s.gender === 'male').length,
        female: classStudents.filter((s) => s.gender === 'female').length,
        eal: classStudents.filter((s) => s.isEAL).length,
        behaviorAvg:
          classStudents.length > 0
            ? classStudents.reduce((sum, s) => sum + s.behavior, 0) / classStudents.length
            : 0,
        abilityAvg:
          classStudents.length > 0
            ? classStudents.reduce((sum, s) => sum + s.ability, 0) / classStudents.length
            : 0,
        ehcp: classStudents.filter((s) => s.ehcp).length,
        send: classStudents.filter((s) => s.send).length,
        ppg: classStudents.filter((s) => s.ppg).length,
        avgSatisfaction:
          classSatisfaction.length > 0
            ? classSatisfaction.reduce((sum, s) => sum + s.score, 0) / classSatisfaction.length
            : 100,
        violations: classSatisfaction.filter((s) => s.hasBlacklistViolation).length,
      };
    });

    return {
      avgSatisfaction,
      satisfactionDistribution,
      classStats,
      totalStudents: assignedStudents.length,
      totalMale: assignedStudents.filter((s) => s.gender === 'male').length,
      totalFemale: assignedStudents.filter((s) => s.gender === 'female').length,
      totalEAL: assignedStudents.filter((s) => s.isEAL).length,
      totalEHCP: assignedStudents.filter((s) => s.ehcp).length,
      totalSEND: assignedStudents.filter((s) => s.send).length,
      totalPPG: assignedStudents.filter((s) => s.ppg).length,
      overallBehavior:
        assignedStudents.length > 0
          ? assignedStudents.reduce((sum, s) => sum + s.behavior, 0) / assignedStudents.length
          : 0,
      overallAbility:
        assignedStudents.length > 0
          ? assignedStudents.reduce((sum, s) => sum + s.ability, 0) / assignedStudents.length
          : 0,
    };
  }, [assignedStudents, classes, students]);

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
    overallBehavior,
    overallAbility,
  } = statistics;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Statistics Overview</h2>
        <p className="text-sm text-gray-500">
          Summary of class assignments and satisfaction metrics.
        </p>
      </div>

      {/* Overall Stats */}
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
          <p className="text-sm text-gray-500">Classes</p>
          <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Violations</p>
          <p className={`text-2xl font-bold ${satisfactionDistribution.violations > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {satisfactionDistribution.violations}
          </p>
        </div>
      </div>

      {/* Additional Student Factors */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Behavior Avg</p>
          <p className="text-2xl font-bold text-gray-900">{overallBehavior.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Ability Avg</p>
          <p className="text-2xl font-bold text-gray-900">{overallAbility.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">EHCP</p>
          <p className="text-2xl font-bold text-gray-900">{totalEHCP}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">SEND</p>
          <p className="text-2xl font-bold text-gray-900">{totalSEND}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">PPG</p>
          <p className="text-2xl font-bold text-gray-900">{totalPPG}</p>
        </div>
      </div>

      {/* Satisfaction Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Satisfaction Distribution</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-700">Excellent (80-100%)</span>
              <span className="text-gray-600">{satisfactionDistribution.excellent} students</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{
                  width: `${(satisfactionDistribution.excellent / totalStudents) * 100}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-yellow-700">Good (40-79%)</span>
              <span className="text-gray-600">{satisfactionDistribution.good} students</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500"
                style={{
                  width: `${(satisfactionDistribution.good / totalStudents) * 100}%`,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-orange-700">Needs Attention (0-39%)</span>
              <span className="text-gray-600">{satisfactionDistribution.poor} students</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500"
                style={{
                  width: `${(satisfactionDistribution.poor / totalStudents) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Factors by Class */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Additional Factors by Class</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Behavior Avg
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Ability Avg
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  EHCP
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  SEND
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  PPG
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classStats.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{cls.name}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                    {cls.total > 0 ? cls.behaviorAvg.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                    {cls.total > 0 ? cls.abilityAvg.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.ehcp}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.send}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.ppg}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {overallBehavior.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">
                  {overallAbility.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">{totalEHCP}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">{totalSEND}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">{totalPPG}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gender Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">Gender Distribution by Class</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Male
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Female
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  M/F Ratio
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classStats.map((cls) => {
                const malePercent = cls.total > 0 ? (cls.male / cls.total) * 100 : 50;
                return (
                  <tr key={cls.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {cls.name}
                      {cls.teacherName && (
                        <span className="text-gray-400 ml-1">({cls.teacherName})</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.total}</td>
                    <td className="px-4 py-2 text-sm text-right text-blue-600">{cls.male}</td>
                    <td className="px-4 py-2 text-sm text-right text-pink-600">{cls.female}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {cls.total > 0 ? `${malePercent.toFixed(0)}/${(100 - malePercent).toFixed(0)}` : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-4 w-32 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: `${malePercent}%` }}
                        />
                        <div
                          className="h-full bg-pink-400"
                          style={{ width: `${100 - malePercent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">{totalStudents}</td>
                <td className="px-4 py-2 text-sm text-right text-blue-600">{totalMale}</td>
                <td className="px-4 py-2 text-sm text-right text-pink-600">{totalFemale}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-600">
                  {totalStudents > 0
                    ? `${((totalMale / totalStudents) * 100).toFixed(0)}/${((totalFemale / totalStudents) * 100).toFixed(0)}`
                    : '-'}
                </td>
                <td className="px-4 py-2">
                  <div className="h-4 w-32 bg-gray-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-blue-400"
                      style={{ width: `${totalStudents > 0 ? (totalMale / totalStudents) * 100 : 50}%` }}
                    />
                    <div
                      className="h-full bg-pink-400"
                      style={{ width: `${totalStudents > 0 ? (totalFemale / totalStudents) * 100 : 50}%` }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* EAL Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-4">EAL Distribution by Class</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  EAL
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  EAL %
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Satisfaction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classStats.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{cls.name}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">{cls.total}</td>
                  <td className="px-4 py-2 text-sm text-right text-yellow-600">{cls.eal}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                    {cls.total > 0 ? `${((cls.eal / cls.total) * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        cls.avgSatisfaction >= 80
                          ? 'bg-green-100 text-green-700'
                          : cls.avgSatisfaction >= 40
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {cls.avgSatisfaction.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                <td className="px-4 py-2 text-sm text-right text-gray-900">{totalStudents}</td>
                <td className="px-4 py-2 text-sm text-right text-yellow-600">{totalEAL}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-600">
                  {totalStudents > 0 ? `${((totalEAL / totalStudents) * 100).toFixed(1)}%` : '-'}
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {avgSatisfaction.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Algorithm Info */}
      {lastSortingResult && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          <p>
            Sorting completed in {lastSortingResult.iterationsUsed.toLocaleString()} iterations.
          </p>
        </div>
      )}
    </div>
  );
}
