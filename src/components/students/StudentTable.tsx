import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useStudentStore } from '../../stores';
import type { Student } from '../../types';
import { EditStudentModal } from './EditStudentModal';

const columnHelper = createColumnHelper<Student>();

export function StudentTable() {
  const { students, deleteStudent, getStudentById, updateStudent } = useStudentStore();
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <span className="font-medium text-gray-900">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('gender', {
        header: 'Gender',
        cell: (info) => {
          const student = info.row.original;
          const isMale = info.getValue() === 'male';
          return (
            <button
              onClick={() => updateStudent(student.id, { gender: isMale ? 'female' : 'male' })}
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                isMale
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
              }`}
              title={`Click to change to ${isMale ? 'Female' : 'Male'}`}
            >
              {isMale ? 'M' : 'F'}
            </button>
          );
        },
      }),
      columnHelper.accessor('isEAL', {
        header: 'EAL',
        cell: (info) => {
          const student = info.row.original;
          const isEAL = info.getValue();
          return (
            <button
              onClick={() => updateStudent(student.id, { isEAL: !isEAL })}
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                isEAL
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={`Click to ${isEAL ? 'remove' : 'mark as'} EAL`}
            >
              {isEAL ? 'Yes' : 'No'}
            </button>
          );
        },
      }),
      columnHelper.accessor('preferredFriends', {
        header: 'Preferred Friends',
        cell: (info) => {
          const friendIds = info.getValue();
          if (friendIds.length === 0) return <span className="text-gray-400">None</span>;
          const friendNames = friendIds
            .map((id) => getStudentById(id)?.name)
            .filter(Boolean);
          return (
            <div className="flex flex-wrap gap-1">
              {friendNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.accessor('blacklistedStudents', {
        header: 'Blacklisted',
        cell: (info) => {
          const blacklistIds = info.getValue();
          if (blacklistIds.length === 0) return <span className="text-gray-400">None</span>;
          const blacklistNames = blacklistIds
            .map((id) => getStudentById(id)?.name)
            .filter(Boolean);
          return (
            <div className="flex flex-wrap gap-1">
              {blacklistNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingStudent(info.row.original)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete ${info.row.original.name}?`)) {
                  deleteStudent(info.row.original.id);
                }
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        ),
      }),
    ],
    [deleteStudent, getStudentById, updateStudent]
  );

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
        />
      )}
    </>
  );
}
