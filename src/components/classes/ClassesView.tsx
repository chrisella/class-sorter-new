import { useEffect, useState } from 'react';
import { useClassStore, useStudentStore } from '../../stores';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { Class } from '../../types';
import { buildTargetSizes } from '../../utils/classSizeUtils';

export function ClassesView() {
  const { classes, addClass, updateClass, deleteClass, deleteAllClasses, generateDefaultClasses } =
    useClassStore();
  const { students } = useStudentStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateCount, setGenerateCount] = useState('3');
  const targetSizes = buildTargetSizes(students.length, classes.length);

  useEffect(() => {
    classes.forEach((cls, index) => {
      const targetSize = targetSizes[index];
      if (targetSize !== undefined && cls.targetSize !== targetSize) {
        updateClass(cls.id, { targetSize });
      }
    });
  }, [classes, targetSizes, updateClass]);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const nextTargetSizes = buildTargetSizes(students.length, classes.length + 1);
    classes.forEach((cls, index) => {
      const targetSize = nextTargetSizes[index];
      if (targetSize !== undefined && cls.targetSize !== targetSize) {
        updateClass(cls.id, { targetSize });
      }
    });

    const targetSize = nextTargetSizes[nextTargetSizes.length - 1] ?? students.length;
    addClass(newClassName.trim(), targetSize, newTeacherName.trim() || undefined);
    setNewClassName('');
    setNewTeacherName('');
    setShowAddForm(false);
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(generateCount, 10);
    if (count > 0 && count <= 10) {
      generateDefaultClasses(count, students.length);
      setShowGenerateDialog(false);
      setGenerateCount('3');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Classes</h2>
          <p className="text-sm text-gray-500">
            {classes.length} classes configured | {students.length} students to distribute
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Auto Generate
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Add Class
          </button>
          {classes.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Add Class Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <form onSubmit={handleAddClass} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class Name
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Class A"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teacher Name (optional)
              </label>
              <input
                type="text"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Mrs. Smith"
              />
            </div>
            <button
              type="submit"
              disabled={!newClassName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewClassName('');
                setNewTeacherName('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Classes Grid */}
      {classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, index) => (
            <div
              key={cls.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              {editingId === cls.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    defaultValue={cls.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateClass(cls.id, { name: e.currentTarget.value });
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                  />
                  <input
                    type="text"
                    defaultValue={cls.teacherName || ''}
                    placeholder="Teacher name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateClass(cls.id, { teacherName: e.currentTarget.value || undefined });
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{cls.name}</h3>
                      {cls.teacherName && (
                        <p className="text-sm text-gray-500">{cls.teacherName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(cls.id)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingClass(cls)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Target size: {targetSizes[index] ?? cls.targetSize} students
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No classes configured</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add classes manually or auto-generate them.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setShowGenerateDialog(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Auto Generate
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add Class
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {showClearConfirm && (
        <ConfirmDialog
          title="Clear All Classes"
          message="Are you sure you want to delete all classes?"
          confirmLabel="Delete All"
          onConfirm={() => {
            deleteAllClasses();
            setShowClearConfirm(false);
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {deletingClass && (
        <ConfirmDialog
          title="Delete Class"
          message={`Are you sure you want to delete ${deletingClass.name}?`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteClass(deletingClass.id);
            setDeletingClass(null);
          }}
          onCancel={() => setDeletingClass(null)}
        />
      )}

      {showGenerateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowGenerateDialog(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Auto Generate Classes</h3>
            <form onSubmit={handleGenerateSubmit}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of classes (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={generateCount}
                onChange={(e) => setGenerateCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
