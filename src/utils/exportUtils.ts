import type { Student, Class, ClassStatistics } from '../types';

export function exportStudentsCSV(
  students: Student[],
  getStudentById: (id: string) => Student | undefined
): void {
  const headers = [
    'Name',
    'Gender',
    'EAL',
    'Preferred Friends',
    'Blacklisted Students',
  ];

  const rows = students.map((student) => {
    const preferredFriendNames = student.preferredFriends
      .map((id) => getStudentById(id)?.name)
      .filter(Boolean)
      .join('; ');
    const blacklistedNames = student.blacklistedStudents
      .map((id) => getStudentById(id)?.name)
      .filter(Boolean)
      .join('; ');

    return [
      student.name,
      student.gender === 'male' ? 'M' : 'F',
      student.isEAL ? 'Yes' : 'No',
      preferredFriendNames || '',
      blacklistedNames || '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes(';')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ),
  ].join('\n');

  downloadFile(csvContent, 'students.csv', 'text/csv');
}

export function exportToCSV(
  students: Student[],
  classes: Class[],
  getStudentById: (id: string) => Student | undefined
): void {
  const headers = [
    'Name',
    'Gender',
    'EAL',
    'Assigned Class',
    'Preferred Friends',
    'Friends in Class',
    'Blacklisted Students',
  ];

  const rows = students.map((student) => {
    const assignedClass = classes.find((c) => c.id === student.assignedClassId);
    const preferredFriendNames = student.preferredFriends
      .map((id) => getStudentById(id)?.name)
      .filter(Boolean)
      .join('; ');
    const blacklistedNames = student.blacklistedStudents
      .map((id) => getStudentById(id)?.name)
      .filter(Boolean)
      .join('; ');

    // Count friends in same class
    const friendsInClass = student.preferredFriends.filter((fId) => {
      const friend = getStudentById(fId);
      return friend && friend.assignedClassId === student.assignedClassId;
    }).length;

    return [
      student.name,
      student.gender === 'male' ? 'M' : 'F',
      student.isEAL ? 'Yes' : 'No',
      assignedClass?.name || 'Unassigned',
      preferredFriendNames || '-',
      `${friendsInClass}/${student.preferredFriends.length}`,
      blacklistedNames || '-',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ),
  ].join('\n');

  downloadFile(csvContent, 'class-assignments.csv', 'text/csv');
}

export function exportClassSummaryCSV(
  classStatistics: ClassStatistics[],
  classes: Class[]
): void {
  const headers = [
    'Class Name',
    'Teacher',
    'Total Students',
    'Male',
    'Female',
    'EAL Count',
    'EAL %',
    'Avg Satisfaction',
  ];

  const rows = classStatistics.map((stats) => {
    const cls = classes.find((c) => c.id === stats.classId);
    return [
      stats.className,
      cls?.teacherName || '-',
      stats.totalStudents.toString(),
      stats.genderDistribution.male.toString(),
      stats.genderDistribution.female.toString(),
      stats.ealCount.toString(),
      `${stats.ealPercentage.toFixed(1)}%`,
      `${stats.averageSatisfaction.toFixed(1)}%`,
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  downloadFile(csvContent, 'class-summary.csv', 'text/csv');
}

export function exportToPDF(
  students: Student[],
  classes: Class[],
  classStatistics: ClassStatistics[] | undefined,
  getStudentById: (id: string) => Student | undefined
): void {
  // Create HTML content for the PDF
  const htmlContent = generatePDFHTML(students, classes, classStatistics, getStudentById);

  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

function generatePDFHTML(
  students: Student[],
  classes: Class[],
  classStatistics: ClassStatistics[] | undefined,
  getStudentById: (id: string) => Student | undefined
): string {
  const now = new Date().toLocaleDateString();

  let classesHTML = '';
  for (const cls of classes) {
    const classStudents = students.filter((s) => s.assignedClassId === cls.id);
    const stats = classStatistics?.find((cs) => cs.classId === cls.id);

    classesHTML += `
      <div class="class-section">
        <h2>${cls.name}${cls.teacherName ? ` - ${cls.teacherName}` : ''}</h2>
        <div class="stats">
          <span>Students: ${classStudents.length}</span>
          <span>Male: ${classStudents.filter((s) => s.gender === 'male').length}</span>
          <span>Female: ${classStudents.filter((s) => s.gender === 'female').length}</span>
          <span>EAL: ${classStudents.filter((s) => s.isEAL).length}</span>
          ${stats ? `<span>Satisfaction: ${stats.averageSatisfaction.toFixed(0)}%</span>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Gender</th>
              <th>EAL</th>
              <th>Preferred Friends</th>
              <th>Matched</th>
            </tr>
          </thead>
          <tbody>
            ${classStudents
              .map((student) => {
                const friendsList = student.preferredFriends.map((fId) => {
                  const friend = getStudentById(fId);
                  if (!friend) return null;
                  const inSameClass = friend.assignedClassId === cls.id;
                  return `<span class="${inSameClass ? 'friend-matched' : 'friend-unmatched'}">${friend.name}</span>`;
                }).filter(Boolean).join(', ') || '-';
                const friendsInClass = student.preferredFriends.filter((fId) => {
                  const friend = getStudentById(fId);
                  return friend && friend.assignedClassId === cls.id;
                }).length;
                return `
                  <tr>
                    <td>${student.name}</td>
                    <td>${student.gender === 'male' ? 'M' : 'F'}</td>
                    <td>${student.isEAL ? 'Yes' : '-'}</td>
                    <td>${friendsList}</td>
                    <td>${friendsInClass}/${student.preferredFriends.length}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Class Assignments</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }
        .date {
          color: #666;
          margin-bottom: 20px;
        }
        .class-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        h2 {
          font-size: 14px;
          background: #f0f0f0;
          padding: 8px;
          margin: 0 0 10px 0;
        }
        .stats {
          margin-bottom: 10px;
          color: #666;
        }
        .stats span {
          margin-right: 15px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background: #f5f5f5;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background: #fafafa;
        }
        .friend-matched {
          color: #15803d;
          font-weight: 500;
        }
        .friend-unmatched {
          color: #6b7280;
        }
        @media print {
          body {
            padding: 0;
          }
          .class-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <h1>Class Assignments</h1>
      <div class="date">Generated: ${now}</div>
      ${classesHTML}
    </body>
    </html>
  `;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
