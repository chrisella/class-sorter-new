import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useClassStore, useStudentStore } from '../../stores';
import { calculateStudentSatisfaction } from '../../utils/sortingAlgorithm';
import { exportToCSV, exportToPDF } from '../../utils/exportUtils';
import { AlertDialog } from '../shared/ConfirmDialog';
import type { Student } from '../../types';

interface FriendsTooltipProps {
  student: Student;
  classId: string;
  getStudentById: (id: string) => Student | undefined;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function FriendsTooltip({ student, classId, getStudentById, anchorRef }: FriendsTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [anchorRef]);

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
    satisfaction.hasBlacklistViolation
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
        <div className="mt-1 text-[11px] opacity-80">
          Must with: {getStudentById(student.mustBeWithStudentId)?.name || 'Unknown'}
        </div>
      )}
    </div>
  );
}

export function ResultsView() {
  const { classes, lastSortingResult } = useClassStore();
  const { students, assignStudentToClass, getStudentById } = useStudentStore();
  const [draggedStudent, setDraggedStudent] = useState<Student | null>(null);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [pairWarningMessage, setPairWarningMessage] = useState<string | null>(null);

  const assignedStudents = students.filter((s) => s.assignedClassId !== null);

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
      // Check for blacklist violations
      const targetClassStudents = students.filter((s) => s.assignedClassId === targetClassId);
      const hasViolation =
        draggedStudent.blacklistedStudents.some((bId) =>
          targetClassStudents.some((s) => s.id === bId)
        ) ||
        targetClassStudents.some((s) => s.blacklistedStudents.includes(draggedStudent.id));

      if (hasViolation) {
        setShowViolationAlert(true);
      } else {
        const partner = draggedStudent.mustBeWithStudentId
          ? getStudentById(draggedStudent.mustBeWithStudentId)
          : undefined;
        assignStudentToClass(draggedStudent.id, targetClassId);
        if (partner && partner.assignedClassId !== targetClassId) {
          setPairWarningMessage(
            `This move breaks a must-be-with relationship between ${draggedStudent.name} and ${partner.name}.`
          );
        }
      }
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Class Assignments</h2>
          <p className="text-sm text-gray-500">
            Drag and drop students between classes to make adjustments.
            {lastSortingResult && (
              <span className="ml-2">
                Overall satisfaction: {lastSortingResult.overallSatisfaction.toFixed(1)}%
              </span>
            )}
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
            onClick={() => exportToPDF(students, classes, lastSortingResult?.classStatistics, getStudentById)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => {
          const classStudents = students.filter((s) => s.assignedClassId === cls.id);
          const stats = lastSortingResult?.classStatistics.find((cs) => cs.classId === cls.id);

          return (
            <div
              key={cls.id}
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
                    {stats && (
                      <p className="text-xs text-gray-500">
                        {stats.averageSatisfaction.toFixed(0)}% satisfied
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
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">Satisfaction:</span>
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">80-100%</span>
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">40-79%</span>
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">0-39%</span>
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Violation</span>
      </div>

      {showViolationAlert && (
        <AlertDialog
          title="Cannot Move Student"
          message="This move would create a blacklist violation. Students who are blacklisted from each other cannot be placed in the same class."
          onClose={() => setShowViolationAlert(false)}
        />
      )}

      {pairWarningMessage && (
        <AlertDialog
          title="Must-Be-With Warning"
          message={pairWarningMessage}
          variant="warning"
          onClose={() => setPairWarningMessage(null)}
        />
      )}
    </div>
  );
}
