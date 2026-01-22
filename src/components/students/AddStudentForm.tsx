import { useState } from 'react';
import { useStudentStore } from '../../stores';
import type { Gender } from '../../types';
import { StudentSelect } from './StudentSelect';

interface Props {
  onClose: () => void;
}

export function AddStudentForm({ onClose }: Props) {
  const { addStudent, students } = useStudentStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [isEAL, setIsEAL] = useState(false);
  const [preferredFriends, setPreferredFriends] = useState<string[]>([]);
  const [blacklistedStudents, setBlacklistedStudents] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addStudent({
      name: name.trim(),
      gender,
      isEAL,
      preferredFriends: preferredFriends.slice(0, 3),
      blacklistedStudents,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Add Student</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter student name"
              autoFocus
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="male"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                  className="mr-2"
                />
                Male
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="female"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                  className="mr-2"
                />
                Female
              </label>
            </div>
          </div>

          {/* EAL */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isEAL}
                onChange={(e) => setIsEAL(e.target.checked)}
                className="mr-2 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                English as Additional Language (EAL)
              </span>
            </label>
          </div>

          {/* Preferred Friends */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Friends (max 3)
            </label>
            <StudentSelect
              students={students}
              selectedIds={preferredFriends}
              excludeIds={blacklistedStudents}
              onChange={setPreferredFriends}
              maxSelections={3}
              placeholder="Select preferred friends..."
            />
          </div>

          {/* Blacklisted Students */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cannot be placed with
            </label>
            <StudentSelect
              students={students}
              selectedIds={blacklistedStudents}
              excludeIds={preferredFriends}
              onChange={setBlacklistedStudents}
              placeholder="Select students to avoid..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
