import { useState, useCallback } from 'react';
import { useStudentStore } from '../../stores';
import type { Gender } from '../../types';

interface Props {
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  gender: Gender;
  isEAL: boolean;
  preferredFriendNames: string[];
  blacklistedStudentNames: string[];
  isValid: boolean;
  errors: string[];
}

export function ImportDialog({ onClose }: Props) {
  const { importStudents } = useStudentStore();
  const [_csvContent, setCsvContent] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState('');

  const parseCSV = useCallback((content: string) => {
    setError('');
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      setError('CSV must have a header row and at least one data row');
      setParsedRows([]);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIndex = headers.findIndex((h) => h.includes('name'));
    const genderIndex = headers.findIndex((h) => h.includes('gender'));
    const ealIndex = headers.findIndex((h) => h.includes('eal'));
    const friendsIndex = headers.findIndex((h) => h.includes('friend') || h.includes('prefer'));
    const blacklistIndex = headers.findIndex((h) => h.includes('blacklist') || h.includes('avoid') || h.includes('cannot'));

    if (nameIndex === -1) {
      setError('CSV must have a "Name" column');
      setParsedRows([]);
      return;
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const errors: string[] = [];

      const name = values[nameIndex]?.trim() || '';
      if (!name) {
        errors.push('Name is required');
      }

      let gender: Gender = 'male';
      if (genderIndex !== -1) {
        const genderValue = values[genderIndex]?.trim().toLowerCase() || '';
        if (genderValue.startsWith('f')) {
          gender = 'female';
        } else if (!genderValue.startsWith('m') && genderValue) {
          errors.push(`Invalid gender: ${genderValue}`);
        }
      }

      let isEAL = false;
      if (ealIndex !== -1) {
        const ealValue = values[ealIndex]?.trim().toLowerCase() || '';
        isEAL = ealValue === 'yes' || ealValue === 'true' || ealValue === '1' || ealValue === 'y';
      }

      let preferredFriendNames: string[] = [];
      if (friendsIndex !== -1) {
        const friendsValue = values[friendsIndex]?.trim() || '';
        preferredFriendNames = friendsValue
          .split(/[;|]/)
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, 3);
      }

      let blacklistedStudentNames: string[] = [];
      if (blacklistIndex !== -1) {
        const blacklistValue = values[blacklistIndex]?.trim() || '';
        blacklistedStudentNames = blacklistValue
          .split(/[;|]/)
          .map((n) => n.trim())
          .filter(Boolean);
      }

      rows.push({
        name,
        gender,
        isEAL,
        preferredFriendNames,
        blacklistedStudentNames,
        isValid: errors.length === 0 && name.length > 0,
        errors,
      });
    }

    setParsedRows(rows);
  }, []);

  // Simple CSV line parser that handles quoted values
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('No valid rows to import');
      return;
    }

    importStudents(
      validRows.map((r) => ({
        name: r.name,
        gender: r.gender,
        isEAL: r.isEAL,
        preferredFriendNames: r.preferredFriendNames,
        blacklistedStudentNames: r.blacklistedStudentNames,
      }))
    );

    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Import Students from CSV</h3>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-auto">
          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload CSV file
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Format help */}
          <div className="bg-gray-50 rounded-md p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">CSV Format:</p>
            <p className="text-gray-600 mb-2">
              Required columns: <code className="bg-gray-200 px-1 rounded">Name</code>
            </p>
            <p className="text-gray-600 mb-2">
              Optional columns: <code className="bg-gray-200 px-1 rounded">Gender</code> (M/F),{' '}
              <code className="bg-gray-200 px-1 rounded">EAL</code> (Yes/No),{' '}
              <code className="bg-gray-200 px-1 rounded">Preferred Friends</code> (names separated by ; or |),{' '}
              <code className="bg-gray-200 px-1 rounded">Blacklist</code> (names separated by ; or |)
            </p>
            <p className="text-gray-500 text-xs">
              Example: Name,Gender,EAL,Friends,Blacklist
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Preview</p>
                <p className="text-sm text-gray-500">
                  <span className="text-green-600">{validCount} valid</span>
                  {invalidCount > 0 && (
                    <span className="text-red-600 ml-2">{invalidCount} invalid</span>
                  )}
                </p>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Gender</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">EAL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Friends</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className={row.isValid ? '' : 'bg-red-50'}>
                        <td className="px-3 py-2">{row.name || '-'}</td>
                        <td className="px-3 py-2">{row.gender === 'male' ? 'M' : 'F'}</td>
                        <td className="px-3 py-2">{row.isEAL ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2">{row.preferredFriendNames.join(', ') || '-'}</td>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="text-green-600">Valid</span>
                          ) : (
                            <span className="text-red-600" title={row.errors.join(', ')}>
                              Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="px-3 py-2 text-sm text-gray-500 bg-gray-50">
                    ...and {parsedRows.length - 20} more rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import {validCount} Student{validCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
