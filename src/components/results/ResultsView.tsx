import { useState, useRef, useLayoutEffect } from 'react';
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
    <div className="text-gray-400">No preferred friends</div>
  ) : (
    <>
      <div className="font-medium mb-1.5 text-gray-300">Preferred Friends</div>
      <div className="space-y-1">
        {student.preferredFriends.map((friendId) => {
          const friend = getStudentById(friendId);
          if (!friend) return null;
          const inSameClass = friend.assignedClassId === classId;
          return (
            <div key={friendId} className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${inSameClass ? 'bg-green-400' : 'bg-gray-500'}`}
              />
              <span className={inSameClass ? 'text-green-300' : 'text-gray-400'}>
                {friend.name}
              </span>
              {inSameClass && (
                <span className="text-green-400 text-[10px]">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return createPortal(
    <div
      className="fixed px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 min-w-40 -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
      {content}
    </div>,
    document.body
  );
}

interface StudentCardProps {
  student: Student;
  classId: string;
  students: Student[];
  getStudentById: (id: string) => Student | undefined;
  getSatisfactionColor: (score: number, hasViolation: boolean) => string;
  onDragStart: (e: React.DragEvent, student: Student) => void;
}

function StudentCard({
  student,
  classId,
  students,
  getStudentById,
  getSatisfactionColor,
  onDragStart,
}: StudentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const satisfaction = calculateStudentSatisfaction(student, classId, students);
  const colorClass = getSatisfactionColor(
    satisfaction.score,
    satisfaction.hasBlacklistViolation || satisfaction.hasMustBeWithViolation
  );

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(e) => onDragStart(e, student)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative px-3 py-2 rounded border cursor-move hover:shadow-sm transition-shadow ${colorClass}`}
    >
      {isHovered && (
        <FriendsTooltip
          student={student}
          classId={classId}
          getStudentById={getStudentById}
          anchorRef={cardRef}
        />
      )}
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{student.name}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs">
            {student.gender === 'male' ? 'M' : 'F'}
          </span>
          {student.isEAL && (
            <span className="text-xs px-1 bg-white/50 rounded">
              EAL
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-xs opacity-75">
        {satisfaction.hasBlacklistViolation ? (
          <span className="text-red-700 font-medium">
            Blacklist violation!
          </span>
        ) : satisfaction.hasMustBeWithViolation ? (
          <span className="text-red-700 font-medium">
            Must-with broken!
          </span>
        ) : satisfaction.maxPossibleFriends > 0 ? (
          <span>
            {satisfaction.preferredFriendsInClass}/
            {satisfaction.maxPossibleFriends} friends (
            {satisfaction.score.toFixed(0)}%)
          </span>
        ) : (
          <span>No friend preferences</span>
        )}
      </div>
      {student.mustBeWithStudentId && (
        <div
          className={`mt-1 text-[11px] opacity-80 ${
            satisfaction.hasMustBeWithViolation ? 'text-red-700 font-medium' : ''
          }`}
        >
          Must with: {getStudentById(student.mustBeWithStudentId)?.name || 'Unknown'}
        </div>
      )}
    </div>
  );
}

export function ResultsView() {
  const { classes, lastSortingResult, sortingConfig } = useClassStore();
  const { students, assignStudentToClass, getStudentById } = useStudentStore();
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);

  const assignedStudents = students.filter((s) => s.assignedClassId !== null);
  const activeClassSizeMode = lastSortingResult?.classSizeMode ?? sortingConfig.classSizeMode;
  const insights = getAssignmentInsights(students, classes, activeClassSizeMode, 'manual_edit');
  const currentSizeWarning =
    activeClassSizeMode === 'strict'
      ? !insights.sizeCompliance.isExact
      : insights.sizeCompliance.maxDeviation > 1;
  const hasTwoClassLayout = classes.length === 2;
  const hasMultiClassGrid = classes.length >= 3;
  const resultsOuterWrapperClassName = hasTwoClassLayout ? 'mx-auto w-full max-w-[1600px]' : 'w-full';
  const resultsGridClassName = hasTwoClassLayout
    ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8'
    : hasMultiClassGrid
    ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
    : 'grid grid-cols-1 gap-4';
  const resultsCardWrapperClassName = hasTwoClassLayout ? 'w-full max-w-[760px] mx-auto' : 'w-full';

  const calculateClassStatistics = (classId: string): ClassStatistics | undefined => {
    const classStudents = sortStudentsAlphabetically(
      students.filter((student) => student.assignedClassId === classId)
    );
    if (classStudents.length === 0) return undefined;

    const studentSatisfaction: ClassStatistics['studentSatisfaction'] = classStudents.map((student) =>
      calculateStudentSatisfaction(student, classId, students)
    );

    const totalSatisfaction = studentSatisfaction.reduce((sum, s) => sum + s.score, 0);
    const avgSatisfaction = classStudents.length > 0 ? totalSatisfaction / classStudents.length : 100;

    return {
      classId,
      className: classes.find((c) => c.id === classId)?.name || '',
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
  };

  const getClassStats = (classId: string) => {
    return calculateClassStatistics(classId);
  };

  if (assignedStudents.length === 0) {
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No results yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Run the sorting algorithm first to see results here.
        </p>
      </div>
    );
  }

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

  const getSatisfactionColor = (score: number, hasViolation: boolean) => {
    if (hasViolation) return 'bg-red-100 border-red-300 text-red-800';
    if (score >= 80) return 'bg-green-100 border-green-300 text-green-800';
    if (score >= 40) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-orange-100 border-orange-300 text-orange-800';
  };

  return (
    <div className="space-y-4">
      {lastSortingResult?.strictOverrideApplied && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Strict sizing required overrides. The auto-sorted result includes{' '}
          {lastSortingResult.violations.filter((violation) => violation.type === 'blacklist').length}{' '}
          blacklist violation(s) and{' '}
          {lastSortingResult.violations.filter((violation) => violation.type === 'must_be_with').length}{' '}
          must-be-with violation(s).
        </div>
      )}

      {currentSizeWarning && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Current class sizes are out of compliance. Targets are{' '}
          {insights.sizeCompliance.targetSizes.join(' / ')}, current sizes are{' '}
          {classes.map((cls) => insights.sizeCompliance.classActualSizes[cls.id] ?? 0).join(' / ')}.
        </div>
      )}

      {!currentSizeWarning && activeClassSizeMode === 'flexible' && insights.sizeCompliance.maxDeviation > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Current class sizes are close to target but not exact. Maximum deviation is{' '}
          {insights.sizeCompliance.maxDeviation}.
        </div>
      )}

      {(insights.blacklistViolations.length > 0 || insights.mustBeWithViolations.length > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Current layout has {insights.blacklistViolations.length} blacklist violation(s) and{' '}
          {insights.mustBeWithViolations.length} must-be-with violation(s).
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Class Assignments</h2>
          <p className="text-sm text-gray-500">
            Drag and drop students between classes to make adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(students, classes, getStudentById)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportToPDF(students, classes, undefined, getStudentById)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className={resultsOuterWrapperClassName}>
        <div className={resultsGridClassName}>
        {classes.map((cls) => {
          const classStudents = sortStudentsAlphabetically(
            students.filter((student) => student.assignedClassId === cls.id)
          );
          const stats = getClassStats(cls.id);
          const targetSize = insights.sizeCompliance.classTargets[cls.id] ?? cls.targetSize;
          const deviation = insights.sizeCompliance.classDeviations[cls.id] ?? 0;
          const isClassOutOfCompliance =
            activeClassSizeMode === 'strict' ? deviation > 0 : deviation > 1;

          return (
            <div key={cls.id} className={resultsCardWrapperClassName}>
              <div
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, cls.id)}
              >
                {/* Class Header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{cls.name}</h3>
                      {cls.teacherName && (
                        <p className="text-xs text-gray-500">{cls.teacherName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {classStudents.length} students
                      </p>
                      <p
                        className={`text-xs ${
                          isClassOutOfCompliance
                            ? 'text-red-600'
                            : deviation > 0
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }`}
                      >
                        Target {targetSize}
                      </p>
                      {stats && (
                          <p className="text-xs text-gray-500">
                            {Math.round(stats.averageSatisfaction)}% satisfied
                          </p>
                      )}
                    </div>
                  </div>
                  {/* Quick stats */}
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    <span>
                      {classStudents.filter((s) => s.gender === 'male').length}M /{' '}
                      {classStudents.filter((s) => s.gender === 'female').length}F
                    </span>
                    <span>{classStudents.filter((s) => s.isEAL).length} EAL</span>
                    <span>{classStudents.filter((s) => s.ehcp).length} EHCP</span>
                    <span>{classStudents.filter((s) => s.send).length} SEND</span>
                    <span>{classStudents.filter((s) => s.ppg).length} PPG</span>
                  </div>
                </div>

                {/* Student List */}
                <div className="p-2 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {classStudents.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4">
                      Drop students here
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {classStudents.map((student) => (
                        <StudentCard
                          key={student.id}
                          student={student}
                          classId={cls.id}
                          students={students}
                          getStudentById={getStudentById}
                          getSatisfactionColor={getSatisfactionColor}
                          onDragStart={handleDragStart}
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">Satisfaction:</span>
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">80-100%</span>
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">40-79%</span>
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">0-39%</span>
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Violation</span>
      </div>
    </div>
  );
}
