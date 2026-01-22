import { useState } from 'react';
import { StudentTable } from './StudentTable';
import { AddStudentForm } from './AddStudentForm';
import { ImportDialog } from './ImportDialog';
import { useStudentStore } from '../../stores';
import { exportStudentsCSV } from '../../utils/exportUtils';

export function StudentView() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { students, deleteAllStudents, getStudentById } = useStudentStore();

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all students? This cannot be undone.')) {
      deleteAllStudents();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Students</h2>
          <p className="text-sm text-gray-500">{students.length} students total</p>
        </div>
        <div className="flex items-center gap-2">
          {students.length > 0 && (
            <button
              onClick={() => exportStudentsCSV(students, getStudentById)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Add Student
          </button>
          {students.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Student Table */}
      {students.length > 0 ? (
        <StudentTable />
      ) : (
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No students</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding students or importing a CSV file.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Student
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddForm && <AddStudentForm onClose={() => setShowAddForm(false)} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
    </div>
  );
}
