import { useState } from 'react';
import { useStudentStore } from '../../stores';
import type { Student, Gender, Rank } from '../../types';
import { StudentSelect } from './StudentSelect';

interface Props {
  student: Student;
  onClose: () => void;
}

export function EditStudentModal({ student, onClose }: Props) {
  const { updateStudent, setMustBeWithPair, students } = useStudentStore();
  const [name, setName] = useState(student.name);
  const [gender, setGender] = useState<Gender>(student.gender);
  const [isEAL, setIsEAL] = useState(student.isEAL);
  const [behavior, setBehavior] = useState<Rank>(student.behavior);
  const [ability, setAbility] = useState<Rank>(student.ability);
  const [ehcp, setEhcp] = useState(student.ehcp);
  const [send, setSend] = useState(student.send);
  const [ppg, setPpg] = useState(student.ppg);
  const [preferredFriends, setPreferredFriends] = useState<string[]>(student.preferredFriends);
  const [blacklistedStudents, setBlacklistedStudents] = useState<string[]>(student.blacklistedStudents);
  const [mustBeWith, setMustBeWith] = useState<string[]>(
    student.mustBeWithStudentId ? [student.mustBeWithStudentId] : []
  );
  const [pairError, setPairError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const selectedMustBeWithId = mustBeWith[0] || null;
    const selectedPartner = selectedMustBeWithId
      ? students.find((s) => s.id === selectedMustBeWithId)
      : undefined;
    if (
      selectedMustBeWithId &&
      (
        blacklistedStudents.includes(selectedMustBeWithId) ||
        selectedPartner?.blacklistedStudents.includes(student.id)
      )
    ) {
      setPairError('Must-be-with student cannot also be blacklisted.');
      return;
    }

    updateStudent(student.id, {
      name: name.trim(),
      gender,
      isEAL,
      behavior,
      ability,
      ehcp,
      send,
      ppg,
      preferredFriends: preferredFriends.slice(0, 3),
      blacklistedStudents,
    });

    const pairResult = setMustBeWithPair(student.id, selectedMustBeWithId);
    if (!pairResult.success) {
      setPairError(pairResult.error || 'Could not update must-be-with relationship.');
      return;
    }
    setPairError('');

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Edit Student</h3>
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

          {/* Behavior and Ability */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Behavior</label>
              <select
                value={behavior}
                onChange={(e) => setBehavior(Number(e.target.value) as Rank)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ability</label>
              <select
                value={ability}
                onChange={(e) => setAbility(Number(e.target.value) as Rank)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          </div>

          {/* Additional Needs/Funding */}
          <div className="grid grid-cols-3 gap-3">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={ehcp}
                onChange={(e) => setEhcp(e.target.checked)}
                className="mr-2 rounded"
              />
              EHCP
            </label>
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={send}
                onChange={(e) => setSend(e.target.checked)}
                className="mr-2 rounded"
              />
              SEND
            </label>
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={ppg}
                onChange={(e) => setPpg(e.target.checked)}
                className="mr-2 rounded"
              />
              PPG
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
              excludeSelf={student.id}
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
              excludeIds={[...preferredFriends, ...mustBeWith]}
              excludeSelf={student.id}
              onChange={setBlacklistedStudents}
              placeholder="Select students to avoid..."
            />
          </div>

          {/* Must Be With */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Must be with (optional)
            </label>
            <StudentSelect
              students={students}
              selectedIds={mustBeWith}
              excludeIds={blacklistedStudents}
              excludeSelf={student.id}
              onChange={setMustBeWith}
              maxSelections={1}
              placeholder="Select one student..."
            />
            {pairError && (
              <p className="mt-1 text-xs text-red-600">{pairError}</p>
            )}
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
