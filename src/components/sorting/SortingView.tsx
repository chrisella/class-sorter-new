import { useState } from 'react';
import { useClassStore, useStudentStore, useUIStore } from '../../stores';
import { runSorting } from '../../utils/sortingAlgorithm';
import { buildTargetSizes } from '../../utils/classSizeUtils';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { SortingResult } from '../../types';

export function SortingView() {
  const { students, assignStudentToClass, clearAllAssignments } = useStudentStore();
  const { classes, sortingConfig, setSortingConfig, setLastSortingResult } = useClassStore();
  const { setView, isSorting, setIsSorting, sortingProgress, setSortingProgress } = useUIStore();
  const [error, setError] = useState('');
  const [pendingStrictResult, setPendingStrictResult] = useState<SortingResult | null>(null);

  const canSort = students.length > 0 && classes.length > 0;
  const targetSizes = buildTargetSizes(students.length, classes.length);
  const targetSizesLabel = targetSizes.join(' / ');

  const applySortingResult = (result: SortingResult) => {
    clearAllAssignments();
    Object.entries(result.assignments).forEach(([studentId, classId]) => {
      assignStudentToClass(studentId, classId);
    });
    setLastSortingResult(result);
    setPendingStrictResult(null);
    setView('results');
  };

  const handleSort = async () => {
    if (!canSort) return;

    setError('');
    setIsSorting(true);
    setSortingProgress(0);

    try {
      const result = await runSorting(
        students,
        classes,
        sortingConfig,
        (progress) => setSortingProgress(progress)
      );

      const blockingViolations = result.violations.filter(
        (violation) => violation.type === 'blacklist' || violation.type === 'must_be_with'
      );

      if (sortingConfig.classSizeMode === 'strict' && blockingViolations.length > 0) {
        setPendingStrictResult(result);
      } else {
        applySortingResult(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sorting failed');
    } finally {
      setIsSorting(false);
      setSortingProgress(0);
    }
  };

  const totalBlacklists = students.reduce((sum, s) => sum + s.blacklistedStudents.length, 0);
  const totalPreferences = students.reduce((sum, s) => sum + s.preferredFriends.length, 0);
  const totalEHCP = students.filter((s) => s.ehcp).length;
  const totalSEND = students.filter((s) => s.send).length;
  const totalPPG = students.filter((s) => s.ppg).length;
  const totalMustBeWithPairs = (() => {
    const seen = new Set<string>();
    let count = 0;
    for (const student of students) {
      const partnerId = student.mustBeWithStudentId;
      if (!partnerId) continue;
      const key = [student.id, partnerId].sort().join(':');
      if (!seen.has(key)) {
        seen.add(key);
        count++;
      }
    }
    return count;
  })();
  const safeWeight = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const priorityWeights = {
    friendPreference: safeWeight(sortingConfig.priorityWeights.friendPreference, 0.6),
    classSizeBalance: safeWeight(sortingConfig.priorityWeights.classSizeBalance, 0.8),
    genderBalance: safeWeight(sortingConfig.priorityWeights.genderBalance, 0.2),
    ealBalance: safeWeight(sortingConfig.priorityWeights.ealBalance, 0.2),
    behaviorBalance: safeWeight(sortingConfig.priorityWeights.behaviorBalance, 0.2),
    abilityBalance: safeWeight(sortingConfig.priorityWeights.abilityBalance, 0.2),
    ehcpBalance: safeWeight(sortingConfig.priorityWeights.ehcpBalance, 0.2),
    sendBalance: safeWeight(sortingConfig.priorityWeights.sendBalance, 0.2),
    ppgBalance: safeWeight(sortingConfig.priorityWeights.ppgBalance, 0.2),
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Sort Students into Classes</h2>
        <p className="text-sm text-gray-500">
          Configure the sorting algorithm and run it to generate class assignments.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Prerequisites</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {students.length > 0 ? (
              <span className="text-green-600">&#10003;</span>
            ) : (
              <span className="text-red-600">&#10007;</span>
            )}
            <span className={students.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
              {students.length} students added
            </span>
          </div>
          <div className="flex items-center gap-2">
            {classes.length > 0 ? (
              <span className="text-green-600">&#10003;</span>
            ) : (
              <span className="text-red-600">&#10007;</span>
            )}
            <span className={classes.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
              {classes.length} classes configured
            </span>
          </div>
        </div>
      </div>

      {/* Constraints Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Constraints Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Derived target sizes</p>
            <p className="text-lg font-medium">{targetSizesLabel || '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Size enforcement</p>
            <p className="text-lg font-medium capitalize">{sortingConfig.classSizeMode}</p>
          </div>
          <div>
            <p className="text-gray-500">Blacklist pairs (hard)</p>
            <p className="text-lg font-medium text-red-600">{totalBlacklists}</p>
          </div>
          <div>
            <p className="text-gray-500">Friend preferences (soft)</p>
            <p className="text-lg font-medium text-green-600">{totalPreferences}</p>
          </div>
          <div>
            <p className="text-gray-500">Male students</p>
            <p className="text-lg font-medium">{students.filter((s) => s.gender === 'male').length}</p>
          </div>
          <div>
            <p className="text-gray-500">Female students</p>
            <p className="text-lg font-medium">{students.filter((s) => s.gender === 'female').length}</p>
          </div>
          <div>
            <p className="text-gray-500">EAL students</p>
            <p className="text-lg font-medium">{students.filter((s) => s.isEAL).length}</p>
          </div>
          <div>
            <p className="text-gray-500">EHCP students</p>
            <p className="text-lg font-medium">{totalEHCP}</p>
          </div>
          <div>
            <p className="text-gray-500">SEND students</p>
            <p className="text-lg font-medium">{totalSEND}</p>
          </div>
          <div>
            <p className="text-gray-500">PPG students</p>
            <p className="text-lg font-medium">{totalPPG}</p>
          </div>
          <div>
            <p className="text-gray-500">Must-with pairs</p>
            <p className="text-lg font-medium">{totalMustBeWithPairs}</p>
          </div>
          <div>
            <p className="text-gray-500">Students per class (avg)</p>
            <p className="text-lg font-medium">
              {classes.length > 0 ? Math.round(students.length / classes.length) : '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Class Size Enforcement</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="classSizeMode"
              checked={sortingConfig.classSizeMode !== 'flexible'}
              onChange={() => setSortingConfig({ classSizeMode: 'strict' })}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Strict</div>
              <div className="text-sm text-gray-500">
                Exact legal class sizes. May override blacklist and must-be-with constraints to hit
                the required split.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="classSizeMode"
              checked={sortingConfig.classSizeMode === 'flexible'}
              onChange={() => setSortingConfig({ classSizeMode: 'flexible' })}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">Flexible</div>
              <div className="text-sm text-gray-500">
                Strongly prefers target sizes, but may trade size for a better overall balance.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Priority Weights */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Priority Weights</h3>
        <div className="space-y-4">
          {sortingConfig.classSizeMode === 'flexible' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-700">Class Size Priority</label>
                <span className="text-sm text-gray-500">
                  {Math.round(priorityWeights.classSizeBalance * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={priorityWeights.classSizeBalance * 100}
                onChange={(e) =>
                  setSortingConfig({
                    priorityWeights: {
                      ...priorityWeights,
                      classSizeBalance: parseInt(e.target.value, 10) / 100,
                    },
                  })
                }
                className="w-full"
              />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">Friend Preferences</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.friendPreference * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.friendPreference * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    friendPreference: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">Gender Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.genderBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.genderBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    genderBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">EAL Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.ealBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.ealBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    ealBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">Behavior Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.behaviorBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.behaviorBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    behaviorBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">Ability Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.abilityBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.abilityBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    abilityBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">EHCP Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.ehcpBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.ehcpBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    ehcpBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">SEND Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.sendBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.sendBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    sendBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-700">PPG Balance</label>
              <span className="text-sm text-gray-500">
                {Math.round(priorityWeights.ppgBalance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priorityWeights.ppgBalance * 100}
              onChange={(e) =>
                setSortingConfig({
                  priorityWeights: {
                    ...priorityWeights,
                    ppgBalance: parseInt(e.target.value, 10) / 100,
                  },
                })
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Algorithm Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">Algorithm Settings</h3>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Max Iterations</label>
          <input
            type="number"
            min="1000"
            max="100000"
            step="1000"
            value={sortingConfig.maxIterations}
            onChange={(e) =>
              setSortingConfig({ maxIterations: parseInt(e.target.value, 10) || 10000 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Higher values may give better results but take longer
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      {/* Sort Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSort}
          disabled={!canSort || isSorting}
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSorting ? 'Sorting...' : 'Run Sorting Algorithm'}
        </button>
        {isSorting && (
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${sortingProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">{Math.round(sortingProgress)}% complete</p>
          </div>
        )}
      </div>

      {!canSort && (
        <p className="text-sm text-amber-600">
          Please add students and configure classes before sorting.
        </p>
      )}

      {pendingStrictResult && (
        <ConfirmDialog
          title="Strict Size Overrides Required"
          message={`Exact target sizes (${targetSizesLabel}) were achieved, but this result introduces ${
            pendingStrictResult.violations.filter((violation) => violation.type === 'blacklist').length
          } blacklist violation(s) and ${
            pendingStrictResult.violations.filter((violation) => violation.type === 'must_be_with').length
          } must-be-with violation(s). Apply this strict result?`}
          confirmLabel="Apply Result"
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={() => applySortingResult(pendingStrictResult)}
          onCancel={() => setPendingStrictResult(null)}
        />
      )}
    </div>
  );
}
