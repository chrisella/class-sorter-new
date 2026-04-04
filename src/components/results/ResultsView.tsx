import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useClassStore, useStudentStore } from '../../stores';
import { calculateStudentSatisfaction, getAssignmentInsights } from '../../utils/sortingAlgorithm';
import { exportToCSV, exportToPDF, sortStudentsAlphabetically } from '../../utils/exportUtils';
import type { Student, ClassStatistics } from '../../types';

interface FriendsTooltipProps {
  student: Student;
  classId: string;
  getStudentById: (id: string) => Student | undefined;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function FriendsTooltip({ student, classId, getStudentById, anchorRef }: FriendsTooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    } else {
      setPosition(null);
    }
  }, [anchorRef]);

  if (position === null) {
    return null;
  }

  const content = student.preferredFriends.length === 0 ? (
    <div className="text-slate-400">No preferred friends recorded</div>
  ) : (
    <>
      <div className="mb-1.5 font-medium text-slate-200">Friend requests</div>
      <div className="space-y-1">
        {student.preferredFriends.map((friendId) => {
          const friend = getStudentById(friendId);
          if (!friend) return null;
          const inSameClass = friend.assignedClassId === classId;

          return (
            <div key={friendId} className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${inSameClass ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className={inSameClass ? 'text-emerald-300' : 'text-slate-300'}>{friend.name}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  return createPortal(
    <div
      className="fixed z-50 min-w-44 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
      {content}
    </div>,
    document.body
  );
}

interface StudentCardProps {
  student: Student;
  classId: string;
  students: Student[];
  classOptions: Array<{ id: string; name: string }>;
  getStudentById: (id: string) => Student | undefined;
  getSatisfactionTone: (score: number, hasViolation: boolean) => string;
  onDragStart: (e: React.DragEvent, student: Student) => void;
  onMove: (studentId: string, targetClassId: string) => void;
}

function StudentCard({
  student,
  classId,
  students,
  classOptions,
  getStudentById,
  getSatisfactionTone,
  onDragStart,
  onMove,
}: StudentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const satisfaction = calculateStudentSatisfaction(student, classId, students);
  const hasViolation = satisfaction.hasBlacklistViolation || satisfaction.hasMustBeWithViolation;
  const toneClassName = getSatisfactionTone(satisfaction.score, hasViolation);
  const friendSummary =
    satisfaction.maxPossibleFriends > 0
      ? `${satisfaction.preferredFriendsInClass}/${satisfaction.maxPossibleFriends} requested friends matched`
      : 'No friend requests recorded';

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(e) => onDragStart(e, student)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-xl border p-3 shadow-sm ${toneClassName}`}
    >
      {isHovered && (
        <FriendsTooltip
          student={student}
          classId={classId}
          getStudentById={getStudentById}
          anchorRef={cardRef}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{student.name}</p>
          <p className="mt-1 text-xs opacity-80">
            {hasViolation
              ? satisfaction.hasBlacklistViolation
                ? 'Conflict: paired with a pupil they should avoid'
                : 'Conflict: must-stay-together pair is split'
              : friendSummary}
          </p>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] font-semibold">
          {Math.round(satisfaction.score)}%
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
        <span className="rounded-full bg-white/60 px-2 py-1">
          {student.gender === 'male' ? 'Boy' : 'Girl'}
        </span>
        {student.isEAL && <span className="rounded-full bg-white/60 px-2 py-1">EAL</span>}
        {student.ehcp && <span className="rounded-full bg-white/60 px-2 py-1">EHCP</span>}
        {student.send && <span className="rounded-full bg-white/60 px-2 py-1">SEND</span>}
        {student.ppg && <span className="rounded-full bg-white/60 px-2 py-1">PPG</span>}
      </div>

      {student.mustBeWithStudentId && (
        <p className="mt-3 text-[11px] font-medium opacity-80">
          Must stay with: {getStudentById(student.mustBeWithStudentId)?.name || 'Unknown pupil'}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] font-medium opacity-80" htmlFor={`move-${student.id}`}>
          Move to
        </label>
        <select
          id={`move-${student.id}`}
          value={classId}
          onChange={(e) => onMove(student.id, e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        >
          {classOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ResultsView() {
  const { classes, lastSortingResult, sortingConfig } = useClassStore();
  const { students, assignStudentToClass, getStudentById } = useStudentStore();
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  const assignedStudents = students.filter((student) => student.assignedClassId !== null);
  const activeClassSizeMode = lastSortingResult?.classSizeMode ?? sortingConfig.classSizeMode;
  const insights = getAssignmentInsights(students, classes, activeClassSizeMode, 'manual_edit');
  const currentSizeWarning =
    activeClassSizeMode === 'strict'
      ? !insights.sizeCompliance.isExact
      : insights.sizeCompliance.maxDeviation > 1;

  const classOptions = classes.map((cls) => ({ id: cls.id, name: cls.name }));
  const resultsContentHeightClassName = 'xl:h-[calc(100vh-24rem)]';
  const hasTwoClassLayout = classes.length === 2;
  const hasMultiClassGrid = classes.length >= 3;
  const resultsOuterWrapperClassName = hasTwoClassLayout ? 'mx-auto w-full max-w-[1600px]' : 'w-full';
  const resultsGridClassName = hasTwoClassLayout
    ? 'grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8'
    : hasMultiClassGrid
      ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
      : 'grid grid-cols-1 gap-4';
  const resultsCardWrapperClassName = hasTwoClassLayout ? 'mx-auto w-full max-w-[760px]' : 'w-full';

  const statistics = useMemo(() => {
    if (assignedStudents.length === 0) return null;

    const satisfactionScores = assignedStudents.map((student) =>
      calculateStudentSatisfaction(student, student.assignedClassId!, students)
    );
    const avgSatisfaction =
      satisfactionScores.reduce((sum, score) => sum + score.score, 0) / satisfactionScores.length;

    const satisfactionDistribution = {
      strong: satisfactionScores.filter((score) => score.score >= 80).length,
      workable: satisfactionScores.filter((score) => score.score >= 40 && score.score < 80).length,
      attention: satisfactionScores.filter((score) => score.score < 40).length,
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

    return { avgSatisfaction, satisfactionDistribution, classStats };
  }, [assignedStudents, classes, insights.sizeCompliance.classDeviations, insights.sizeCompliance.classTargets, students]);

  if (assignedStudents.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
        <svg
          className="mx-auto h-12 w-12 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">No groups to review yet</h3>
        <p className="mt-2 text-sm text-slate-600">
          Create groups first, then come back here to review the class lists, check any issues, and export the final version.
        </p>
      </div>
    );
  }

  const reviewStatus =
    currentSizeWarning || insights.blacklistViolations.length > 0 || insights.mustBeWithViolations.length > 0
      ? 'Needs attention'
      : 'Ready to export';

  const reviewChecks = [
    currentSizeWarning
      ? `Class sizes are outside the current rule. Targets are ${insights.sizeCompliance.targetSizes.join(' / ')}.`
      : activeClassSizeMode === 'flexible' && insights.sizeCompliance.maxDeviation > 0
        ? `Class sizes are close to target. Largest difference is ${insights.sizeCompliance.maxDeviation} pupil(s).`
        : 'Class sizes match the current rule.',
    insights.blacklistViolations.length > 0
      ? `${insights.blacklistViolations.length} pupil pair(s) are together even though they should be kept apart.`
      : 'No keep-apart conflicts found.',
    insights.mustBeWithViolations.length > 0
      ? `${insights.mustBeWithViolations.length} must-stay-together pair(s) are currently split.`
      : 'All must-stay-together pairs are still together.',
  ];

  const warningCards = [
    {
      title: 'Class size check',
      tone: currentSizeWarning
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      message: currentSizeWarning
        ? `Adjust placements until the groups match ${insights.sizeCompliance.targetSizes.join(' / ')}.`
        : 'Class sizes are acceptable for the current mode.',
      count: currentSizeWarning ? 'Action needed' : 'Clear',
    },
    {
      title: 'Keep-apart conflicts',
      tone:
        insights.blacklistViolations.length > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      message:
        insights.blacklistViolations.length > 0
          ? 'Move the highlighted pupils so each keep-apart pair ends up in different classes.'
          : 'No keep-apart conflicts were found.',
      count: insights.blacklistViolations.length.toString(),
    },
    {
      title: 'Must-stay-together pairs',
      tone:
        insights.mustBeWithViolations.length > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      message:
        insights.mustBeWithViolations.length > 0
          ? 'Move the highlighted pupils so each required pair stays in the same class.'
          : 'All required pairs are together.',
      count: insights.mustBeWithViolations.length.toString(),
    },
    {
      title: 'Friend matches',
      tone: 'border-sky-200 bg-sky-50 text-sky-900',
      message: statistics
        ? `${Math.round(statistics.avgSatisfaction)}% average friend match score across the current layout.`
        : 'Friend match information will appear here once groups exist.',
      count: statistics ? `${statistics.satisfactionDistribution.strong} strong` : '-',
    },
  ];

  const handleDragStart = (e: React.DragEvent, student: Student) => {
    setDraggedStudent(student);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleMove = (studentId: string, targetClassId: string) => {
    const student = students.find((item) => item.id === studentId);
    if (!student || student.assignedClassId === targetClassId) return;
    assignStudentToClass(studentId, targetClassId);
  };

  const handleDrop = (e: React.DragEvent, targetClassId: string) => {
    e.preventDefault();
    if (draggedStudent && draggedStudent.assignedClassId !== targetClassId) {
      assignStudentToClass(draggedStudent.id, targetClassId);
    }
    setDraggedStudent(null);
  };

  const calculateClassStatistics = (classId: string): ClassStatistics | undefined => {
    const classStudents = sortStudentsAlphabetically(
      students.filter((student) => student.assignedClassId === classId)
    );
    if (classStudents.length === 0) return undefined;

    const studentSatisfaction: ClassStatistics['studentSatisfaction'] = classStudents.map((student) =>
      calculateStudentSatisfaction(student, classId, students)
    );

    const totalSatisfaction = studentSatisfaction.reduce((sum, score) => sum + score.score, 0);

    return {
      classId,
      className: classes.find((cls) => cls.id === classId)?.name || '',
      totalStudents: classStudents.length,
      genderDistribution: {
        male: classStudents.filter((student) => student.gender === 'male').length,
        female: classStudents.filter((student) => student.gender === 'female').length,
      },
      ealCount: classStudents.filter((student) => student.isEAL).length,
      ealPercentage: (classStudents.filter((student) => student.isEAL).length / classStudents.length) * 100,
      averageSatisfaction: totalSatisfaction / classStudents.length,
      studentSatisfaction,
    };
  };

  const getSatisfactionTone = (score: number, hasViolation: boolean) => {
    if (hasViolation) return 'border-rose-300 bg-rose-50 text-rose-900';
    if (score >= 80) return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    if (score >= 40) return 'border-amber-300 bg-amber-50 text-amber-900';
    return 'border-orange-300 bg-orange-50 text-orange-900';
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-700">Step 4</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Review groups</h2>
            <p className="mt-2 text-sm text-slate-600">
              Check the highlighted issues first, then make any final adjustments. You can drag pupils between classes or use the move dropdown on each card.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current status</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{reviewStatus}</p>
            <p className="mt-1 text-sm text-slate-600">
              {reviewStatus === 'Ready to export'
                ? 'The current layout has no urgent conflicts.'
                : 'A few issues still need checking before export.'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {warningCards.map((card) => (
            <div key={card.title} className={`rounded-2xl border p-4 ${card.tone}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{card.title}</p>
              <p className="mt-3 text-2xl font-semibold">{card.count}</p>
              <p className="mt-2 text-sm opacity-90">{card.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-900">What to check now</h3>
            <p className="mt-2 text-sm text-slate-600">
              Work down this list from top to bottom. The cards below each class will highlight pupils who may need moving.
            </p>
            <div className="mt-4 space-y-3">
              {reviewChecks.map((check) => (
                <div key={check} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <p className="text-sm text-slate-700">{check}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Finish up</h4>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => exportToCSV(students, classes, getStudentById)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Export class lists as CSV
              </button>
              <button
                type="button"
                onClick={() => exportToPDF(students, classes, undefined, getStudentById)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Export printable PDF
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Export once you are happy with the groups. The detailed analysis below stays available if you need to double-check the numbers.
            </p>
          </div>
        </div>
      </section>

      {lastSortingResult?.strictOverrideApplied && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Exact class sizes were kept, but the automatic result had to accept keep-apart or must-stay-together conflicts to do it. Review the highlighted pupils before exporting.
        </div>
      )}

      <div className={resultsOuterWrapperClassName}>
        <div className={resultsGridClassName}>
          {classes.map((cls) => {
            const classStudents = sortStudentsAlphabetically(
              students.filter((student) => student.assignedClassId === cls.id)
            );
            const stats = calculateClassStatistics(cls.id);
            const actualSize = insights.sizeCompliance.classActualSizes[cls.id] ?? 0;
            const targetSize = insights.sizeCompliance.classTargets[cls.id] ?? cls.targetSize;

            return (
              <div key={cls.id} className={resultsCardWrapperClassName}>
                <div
                  className={`flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${resultsContentHeightClassName}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, cls.id)}
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{cls.name}</h3>
                        {cls.teacherName && <p className="mt-1 text-sm text-slate-500">{cls.teacherName}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {actualSize} of {targetSize} pupils
                        </p>
                        {stats && (
                          <p className="mt-1 text-xs text-slate-500">
                            {Math.round(stats.averageSatisfaction)}% friend match score
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {classStudents.filter((student) => student.gender === 'male').length} boys /{' '}
                        {classStudents.filter((student) => student.gender === 'female').length} girls
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {classStudents.filter((student) => student.isEAL).length} EAL
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {classStudents.filter((student) => student.ehcp).length} EHCP
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {classStudents.filter((student) => student.send).length} SEND
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1">
                        {classStudents.filter((student) => student.ppg).length} PPG
                      </span>
                    </div>
                  </div>

                  <div className="min-h-[240px] flex-1 overflow-y-auto p-3">
                    {classStudents.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        Drop a pupil here or use the move dropdown on another card.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {classStudents.map((student) => (
                          <StudentCard
                            key={student.id}
                            student={student}
                            classId={cls.id}
                            students={students}
                            classOptions={classOptions}
                            getStudentById={getStudentById}
                            getSatisfactionTone={getSatisfactionTone}
                            onDragStart={handleDragStart}
                            onMove={handleMove}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={() => setShowDetailedAnalysis((current) => !current)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Detailed analysis</h3>
            <p className="mt-1 text-sm text-slate-600">
              Use this if you want a fuller breakdown of class sizes, pupil characteristics, and the last automatic run.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {showDetailedAnalysis ? 'Hide details' : 'Show details'}
          </span>
        </button>

        {showDetailedAnalysis && statistics && (
          <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <DetailStat label="Average friend match" value={`${statistics.avgSatisfaction.toFixed(1)}%`} />
              <DetailStat label="Strong matches" value={statistics.satisfactionDistribution.strong.toString()} />
              <DetailStat label="Workable matches" value={statistics.satisfactionDistribution.workable.toString()} />
              <DetailStat label="Need attention" value={statistics.satisfactionDistribution.attention.toString()} />
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-500">Class</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Actual</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Target</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Difference</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">EAL</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">EHCP</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">SEND</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">PPG</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-500">Friend match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {statistics.classStats.map((cls) => (
                    <tr key={cls.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {cls.name}
                        {cls.teacherName && <span className="ml-1 text-slate-400">({cls.teacherName})</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.total}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.target}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          cls.deviation === 0
                            ? 'text-emerald-600'
                            : activeClassSizeMode === 'strict' || cls.deviation > 1
                              ? 'text-rose-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {cls.deviation}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.eal}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.ehcp}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.send}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.ppg}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{cls.avgSatisfaction.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lastSortingResult && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Last automatic run used {lastSortingResult.iterationsUsed.toLocaleString()} iterations in{' '}
                <span className="capitalize">{lastSortingResult.classSizeMode}</span> mode.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
