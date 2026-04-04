import { useState } from 'react';
import { StudentTable } from './StudentTable';
import { AddStudentForm } from './AddStudentForm';
import { ImportDialog } from './ImportDialog';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { useStudentStore } from '../../stores';
import { exportStudentsCSV } from '../../utils/exportUtils';

export function StudentView() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { students, deleteAllStudents, getStudentById } = useStudentStore();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-700">Step 1</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Add your pupils</h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with a CSV import if you already have a class list, or add pupils one by one. You can still edit every detail later.
          </p>
          <p className="mt-2 text-sm text-slate-500">{students.length} pupils currently loaded</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Add Pupil
          </button>
          {students.length > 0 && (
            <button
              onClick={() => exportStudentsCSV(students, getStudentById)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import CSV
          </button>
          {students.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Remove All Pupils
            </button>
          )}
        </div>
      </div>

      {/* Student Table */}
      {students.length > 0 ? (
        <StudentTable />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white py-14 text-center shadow-sm">
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No pupils added yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Import your pupil list from CSV for the quickest start, or add pupils one at a time if you are building the list manually.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
            >
              Add Pupil
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddForm && <AddStudentForm onClose={() => setShowAddForm(false)} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
      {showClearConfirm && (
        <ConfirmDialog
          title="Remove All Pupils"
          message="Are you sure you want to remove every pupil from this list? This cannot be undone."
          confirmLabel="Delete All"
          onConfirm={() => {
            deleteAllStudents();
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
