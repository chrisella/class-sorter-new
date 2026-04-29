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

  const mustBeWithPartner = student.mustBeWithStudentId ? getStudentById(student.mustBeWithStudentId) : null;
  const hasSections =
    student.preferredFriends.length > 0 ||
    mustBeWithPartner !== null ||
    student.blacklistedStudents.length > 0;

  return createPortal(
    <div
      className="fixed z-50 min-w-48 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs text-white shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />

      {!hasSections && (
        <div className="text-slate-400">No constraints recorded</div>
      )}

      {mustBeWithPartner && (
        <div className={student.preferredFriends.length > 0 ? 'mb-3' : ''}>
          <div className="mb-1.5 font-medium text-violet-300">Must stay with</div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                mustBeWithPartner.assignedClassId === classId ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span
              className={
                mustBeWithPartner.assignedClassId === classId ? 'text-emerald-300' : 'text-rose-300'
              }
            >
              {mustBeWithPartner.name}
            </span>
            {mustBeWithPartner.assignedClassId !== classId && (
              <span className="text-rose-400">— split!</span>
            )}
          </div>
        </div>
      )}

      {student.blacklistedStudents.length > 0 && (
        <div className={student.preferredFriends.length > 0 ? 'mb-3' : mustBeWithPartner ? 'mt-3 border-t border-slate-700 pt-3' : ''}>
          <div className="mb-1.5 font-medium text-rose-300">Keep apart from</div>
          <div className="space-y-1">
            {student.blacklistedStudents.map((peerId) => {
              const peer = getStudentById(peerId);
              if (!peer) return null;
              const conflict = peer.assignedClassId === classId;
              return (
                <div key={peerId} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${conflict ? 'bg-rose-400' : 'bg-slate-500'}`} />
                  <span className={conflict ? 'text-rose-300' : 'text-slate-300'}>{peer.name}</span>
                  {conflict && <span className="text-rose-400">— conflict!</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {student.preferredFriends.length > 0 && (
        <div className={mustBeWithPartner || student.blacklistedStudents.length > 0 ? 'border-t border-slate-700 pt-3' : ''}>
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
        </div>
      )}
    </div>,
    document.body
  );
}

type FocusRelationship = 'none' | 'focused' | 'must-be-with' | 'friend' | 'blacklist' | 'unrelated';

interface StudentCardProps {
  student: Student;
  classId: string;
  students: Student[];
  getStudentById: (id: string) => Student | undefined;
  getSatisfactionTone: (score: number, hasViolation: boolean) => string;
  onDragStart: (e: React.DragEvent, student: Student) => void;
  focusedStudentId: string | null;
  focusedStudent: Student | null;
  onFocusToggle: (studentId: string) => void;
}

function StudentRow({
  student,
  classId,
  students,
  getStudentById,
  getSatisfactionTone,
  onDragStart,
  focusedStudentId,
  focusedStudent,
  onFocusToggle,
}: StudentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const satisfaction = calculateStudentSatisfaction(student, classId, students);
  const hasViolation = satisfaction.hasBlacklistViolation || satisfaction.hasMustBeWithViolation;
  const toneClassName = getSatisfactionTone(satisfaction.score, hasViolation);

  const relationship: FocusRelationship = (() => {
    if (focusedStudentId === null) return 'none';
    if (student.id === focusedStudentId) return 'focused';
    if (!focusedStudent) return 'unrelated';
    if (
      focusedStudent.mustBeWithStudentId === student.id ||
      student.mustBeWithStudentId === focusedStudentId
    ) return 'must-be-with';
    if (
      focusedStudent.preferredFriends.includes(student.id) ||
      student.preferredFriends.includes(focusedStudentId)
    ) return 'friend';
    if (
      focusedStudent.blacklistedStudents.includes(student.id) ||
      student.blacklistedStudents.includes(focusedStudentId)
    ) return 'blacklist';
    return 'unrelated';
  })();

  const focusRingClass =
    relationship === 'focused'     ? 'ring-2 ring-inset ring-slate-700' :
    relationship === 'must-be-with'? 'ring-2 ring-inset ring-violet-500' :
    relationship === 'friend'      ? 'ring-2 ring-inset ring-emerald-500' :
    relationship === 'blacklist'   ? 'ring-2 ring-inset ring-rose-500' :
    relationship === 'unrelated'   ? 'opacity-25' :
    '';

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => onDragStart(e, student)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); onFocusToggle(student.id); }}
      className={`relative flex cursor-grab items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-opacity duration-150 active:cursor-grabbing ${toneClassName} ${focusRingClass}`}
    >
      {isHovered && relationship !== 'unrelated' && (
        <FriendsTooltip
          student={student}
          classId={classId}
          getStudentById={getStudentById}
          anchorRef={rowRef}
        />
      )}

      <svg className="h-3 w-3 shrink-0 opacity-35" fill="currentColor" viewBox="0 0 16 16">
        <circle cx="5" cy="3" r="1.2" /><circle cx="5" cy="8" r="1.2" /><circle cx="5" cy="13" r="1.2" />
        <circle cx="11" cy="3" r="1.2" /><circle cx="11" cy="8" r="1.2" /><circle cx="11" cy="13" r="1.2" />
      </svg>

      <span className="min-w-0 flex-1 truncate text-sm font-medium">{student.name}</span>

      <div className="flex shrink-0 items-center gap-1 text-[10px] font-semibold">
        <span className={`rounded bg-white/70 px-1 py-0.5 ${student.gender === 'male' ? 'text-sky-600' : 'text-fuchsia-600'}`}>
          {student.gender === 'male' ? 'M' : 'F'}
        </span>
        {student.isEAL && <span className="rounded bg-white/70 px-1 py-0.5">EAL</span>}
        {student.ehcp && <span className="rounded bg-white/70 px-1 py-0.5">EHCP</span>}
        {student.send && <span className="rounded bg-white/70 px-1 py-0.5">SEND</span>}
        {student.ppg && <span className="rounded bg-white/70 px-1 py-0.5">PPG</span>}
        {student.mustBeWithStudentId && (
          <span
            className="rounded bg-white/70 px-1 py-0.5 text-violet-600"
            title={`Must stay with: ${getStudentById(student.mustBeWithStudentId)?.name ?? 'Unknown'}`}
          >
            ↔
          </span>
        )}
        {student.blacklistedStudents.length > 0 && (
          <span className="rounded bg-white/70 px-1 py-0.5 text-rose-600" title="Has keep-apart constraints">
            ⊘
          </span>
        )}
      </div>

      <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
        {Math.round(satisfaction.score)}%
      </span>
    </div>
  );
}

export function ResultsView() {
  const { classes, lastSortingResult, sortingConfig } = useClassStore();
  const { students, assignStudentToClass, getStudentById } = useStudentStore();
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  const focusedStudent = focusedStudentId ? (students.find((s) => s.id === focusedStudentId) ?? null) : null;

  const handleFocusToggle = (studentId: string) => {
    setFocusedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const assignedStudents = students.filter((student) => student.assignedClassId !== null);
  const activeClassSizeMode = lastSortingResult?.classSizeMode ?? sortingConfig.classSizeMode;
  const insights = getAssignmentInsights(students, classes, activeClassSizeMode, 'manual_edit');
  const currentSizeWarning =
    activeClassSizeMode === 'strict'
      ? !insights.sizeCompliance.isExact
      : insights.sizeCompliance.maxDeviation > 1;

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

  const handleDragStart = (e: React.DragEvent, student: Student) => {
    setDraggedStudent(student);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    <div className="space-y-4">
      {/* Compact header */}
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Step 4</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">Review groups</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
              reviewStatus === 'Ready to export'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {reviewStatus}
            </span>
            <button
              type="button"
              onClick={() => exportToCSV(students, classes, getStudentById)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => exportToPDF(students, classes, undefined, getStudentById)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <StatusChip ok={!currentSizeWarning} label="Class sizes" count={currentSizeWarning ? insights.sizeCompliance.maxDeviation : undefined} />
          <StatusChip ok={insights.blacklistViolations.length === 0} label="Keep-apart" count={insights.blacklistViolations.length || undefined} />
          <StatusChip ok={insights.mustBeWithViolations.length === 0} label="Must-stay" count={insights.mustBeWithViolations.length || undefined} />
          {statistics && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
              {Math.round(statistics.avgSatisfaction)}% friend match
            </span>
          )}
        </div>
      </section>

      {/* Interaction hint — dismissible */}
      {showHint && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="flex-1 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Click</span> a pupil to highlight their connections across all classes
            {' · '}
            <span className="font-medium text-slate-800">Drag</span> a pupil to move them to a different class
            {' · '}
            <span className="font-medium text-slate-800">Hover</span> to see friend, must-stay, and keep-apart details
          </p>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Focus mode active banner */}
      {focusedStudentId && focusedStudent && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2.5">
          <p className="text-sm text-slate-700">
            Showing connections for <span className="font-semibold">{focusedStudent.name}</span>
            {' — '}
            <span className="text-violet-600">violet ↔ must-stay</span>
            {' · '}
            <span className="text-emerald-600">green = friend</span>
            {' · '}
            <span className="text-rose-600">red ⊘ keep-apart</span>
          </p>
          <button
            type="button"
            onClick={() => setFocusedStudentId(null)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      )}

      {lastSortingResult?.strictOverrideApplied && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Exact class sizes were kept, but the automatic result had to accept keep-apart or must-stay-together conflicts to do it. Review the highlighted pupils before exporting.
        </div>
      )}

      <div className={resultsOuterWrapperClassName} onClick={() => setFocusedStudentId(null)}>
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
                        Drop a pupil here from another class.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {classStudents.map((student) => (
                          <StudentRow
                            key={student.id}
                            student={student}
                            classId={cls.id}
                            students={students}
                            getStudentById={getStudentById}
                            getSatisfactionTone={getSatisfactionTone}
                            onDragStart={handleDragStart}
                            focusedStudentId={focusedStudentId}
                            focusedStudent={focusedStudent}
                            onFocusToggle={handleFocusToggle}
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

        {showDetailedAnalysis && (
          <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-700">Current status checks</h4>
              <div className="space-y-2">
                {reviewChecks.map((check) => (
                  <div key={check} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    <p className="text-sm text-slate-700">{check}</p>
                  </div>
                ))}
              </div>
            </div>

            {statistics && (
              <>
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
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusChip({ ok, label, count }: { ok: boolean; label: string; count?: number }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 ${
      ok
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-rose-200 bg-rose-50 text-rose-700'
    }`}>
      {ok ? '✓' : '✕'} {label}{count !== undefined ? ` (${count})` : ''}
    </span>
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
