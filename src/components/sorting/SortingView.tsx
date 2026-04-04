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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingStrictResult, setPendingStrictResult] = useState<SortingResult | null>(null);

  const canSort = students.length > 0 && classes.length > 0;
  const targetSizes = buildTargetSizes(students.length, classes.length);
  const targetSizesLabel = targetSizes.length > 0 ? targetSizes.join(' / ') : '-';

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
      setError(err instanceof Error ? err.message : 'Creating class groups failed');
    } finally {
      setIsSorting(false);
      setSortingProgress(0);
    }
  };

  const totalBlacklists = students.reduce((sum, student) => sum + student.blacklistedStudents.length, 0);
  const totalPreferences = students.reduce((sum, student) => sum + student.preferredFriends.length, 0);
  const totalEHCP = students.filter((student) => student.ehcp).length;
  const totalSEND = students.filter((student) => student.send).length;
  const totalPPG = students.filter((student) => student.ppg).length;
  const totalMale = students.filter((student) => student.gender === 'male').length;
  const totalFemale = students.filter((student) => student.gender === 'female').length;
  const totalEAL = students.filter((student) => student.isEAL).length;
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

  const readinessLabel = canSort
    ? 'Ready to sort'
    : students.length === 0 && classes.length === 0
    ? 'Add students and classes'
    : students.length === 0
    ? 'Add students'
    : 'Add classes';

  const sliders: Array<{ key: keyof typeof priorityWeights; label: string }> = [
    { key: 'friendPreference', label: 'Keep friends together' },
    { key: 'genderBalance', label: 'Balance boys and girls' },
    { key: 'ealBalance', label: 'Spread EAL pupils evenly' },
    { key: 'behaviorBalance', label: 'Balance behaviour levels' },
    { key: 'abilityBalance', label: 'Balance ability levels' },
    { key: 'ehcpBalance', label: 'Spread EHCP pupils evenly' },
    { key: 'sendBalance', label: 'Spread SEND pupils evenly' },
    { key: 'ppgBalance', label: 'Spread PPG pupils evenly' },
  ];

  const updateWeight = (key: keyof typeof priorityWeights, value: number) => {
    setSortingConfig({
      priorityWeights: {
        ...priorityWeights,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-700">Step 3</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Create groups</h2>
        <p className="mt-2 text-sm text-slate-600">
          Start with the recommended settings below. You can review the groups afterwards and move pupils if you need to.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-900">Ready to sort</h3>
            <p className="text-sm text-gray-500 mt-1">
              The app will aim for the required class-size split using your current pupils and classes.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              canSort ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {readinessLabel}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat label="Students" value={students.length.toString()} />
          <SummaryStat label="Classes" value={classes.length.toString()} />
          <SummaryStat label="Target split" value={targetSizesLabel} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <div>
            <h3 className="font-medium text-gray-900">Advanced settings</h3>
            <p className="text-sm text-gray-500 mt-1">
              Change the class size rule or fine-tune how strongly the app balances each factor.
            </p>
          </div>
          <span className="text-sm font-medium text-blue-600">
            {showAdvanced ? 'Hide' : 'Show'}
          </span>
        </button>

        {showAdvanced && (
          <div className="border-t border-gray-200 px-5 py-5 space-y-5">
            <section className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">Class size rules</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Choose how strictly the groups should stick to the target class sizes.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 p-3">
                  <input
                    type="radio"
                    name="classSizeMode"
                    checked={sortingConfig.classSizeMode !== 'flexible'}
                    onChange={() => setSortingConfig({ classSizeMode: 'strict' })}
                    className="mt-1"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      Keep class sizes exact
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        Recommended
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Best when class numbers must be exact</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Match the target sizes exactly, even if that sometimes means accepting other compromises.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 p-3">
                  <input
                    type="radio"
                    name="classSizeMode"
                    checked={sortingConfig.classSizeMode === 'flexible'}
                    onChange={() => setSortingConfig({ classSizeMode: 'flexible' })}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Allow some flexibility</div>
                    <div className="text-xs text-gray-500 mt-0.5">Best when balance matters more than exact numbers</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Stay close to the target sizes, but allow small differences for a better overall balance.
                    </div>
                  </div>
                </label>
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Current target split: <span className="font-medium text-gray-900">{targetSizesLabel}</span>
              </div>

              {sortingConfig.classSizeMode === 'flexible' && (
                <SliderRow
                  label="Prioritise keeping class sizes close"
                  value={priorityWeights.classSizeBalance}
                  onChange={(value) => updateWeight('classSizeBalance', value)}
                />
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">Fine-tune priorities</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Only change these if you want more control over the balancing rules.
                </p>
              </div>

              <div className="space-y-4">
                {sliders.map((slider) => (
                  <SliderRow
                    key={slider.key}
                    label={slider.label}
                    value={priorityWeights[slider.key]}
                    onChange={(value) => updateWeight(slider.key, value)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">Additional information</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Detailed setup counts for checking the current cohort before sorting.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <SummaryStat label="Blacklist pairs" value={totalBlacklists.toString()} compact />
                <SummaryStat label="Friend preferences" value={totalPreferences.toString()} compact />
                <SummaryStat label="Must-with pairs" value={totalMustBeWithPairs.toString()} compact />
                <SummaryStat label="Boys / Girls" value={`${totalMale} / ${totalFemale}`} compact />
                <SummaryStat label="EAL" value={totalEAL.toString()} compact />
                <SummaryStat label="EHCP" value={totalEHCP.toString()} compact />
                <SummaryStat label="SEND" value={totalSEND.toString()} compact />
                <SummaryStat label="PPG" value={totalPPG.toString()} compact />
                <SummaryStat
                  label="Average per class"
                  value={classes.length > 0 ? Math.round(students.length / classes.length).toString() : '-'}
                  compact
                />
              </div>
            </section>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <button
          onClick={handleSort}
          disabled={!canSort || isSorting}
          className="w-full rounded-2xl bg-sky-600 px-6 py-3 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isSorting ? 'Creating groups...' : 'Create Groups'}
        </button>

        {isSorting && (
          <div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${sortingProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Creating class groups... {Math.round(sortingProgress)}%
            </p>
          </div>
        )}

        {!canSort && (
          <p className="text-sm text-amber-600">
            Add pupils and classes before creating groups.
          </p>
        )}
      </div>

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

function SummaryStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`${compact ? 'text-lg' : 'text-xl'} font-medium text-gray-900 mt-1`}>{value}</p>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-gray-700">{label}</label>
        <span className="text-sm text-gray-500">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value * 100}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        className="w-full"
      />
    </div>
  );
}
