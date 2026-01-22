import { useState, useRef, useEffect } from 'react';
import type { Student } from '../../types';

interface Props {
  students: Student[];
  selectedIds: string[];
  excludeIds?: string[];
  excludeSelf?: string;
  onChange: (ids: string[]) => void;
  maxSelections?: number;
  placeholder?: string;
}

export function StudentSelect({
  students,
  selectedIds,
  excludeIds = [],
  excludeSelf,
  onChange,
  maxSelections,
  placeholder = 'Search students...',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableStudents = students.filter(
    (s) =>
      !selectedIds.includes(s.id) &&
      !excludeIds.includes(s.id) &&
      s.id !== excludeSelf &&
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedStudents = students.filter((s) => selectedIds.includes(s.id));

  const handleSelect = (studentId: string) => {
    if (maxSelections && selectedIds.length >= maxSelections) return;
    onChange([...selectedIds, studentId]);
    setSearch('');
  };

  const handleRemove = (studentId: string) => {
    onChange(selectedIds.filter((id) => id !== studentId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim() && availableStudents.length > 0) {
      e.preventDefault();
      handleSelect(availableStudents[0].id);
    }
  };

  const canAddMore = !maxSelections || selectedIds.length < maxSelections;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedStudents.map((student) => (
          <span
            key={student.id}
            className="inline-flex items-center px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded"
          >
            {student.name}
            <button
              type="button"
              onClick={() => handleRemove(student.id)}
              className="ml-1 hover:text-blue-900"
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      {canAddMore && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
        />
      )}

      {/* Dropdown */}
      {isOpen && canAddMore && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {availableStudents.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {search ? 'No students found' : 'No students available'}
            </div>
          ) : (
            availableStudents.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => handleSelect(student.id)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                {student.name}
                <span className="ml-2 text-xs text-gray-400">
                  {student.gender === 'male' ? 'M' : 'F'}
                  {student.isEAL && ' | EAL'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
