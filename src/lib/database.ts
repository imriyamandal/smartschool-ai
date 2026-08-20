import { Student, Parent, Teacher, Principal, AttendanceRecord, TeacherCallRequest, ManagementSupportRequest, AuditLog } from '../types';

interface InMemoryDB {
  students: Student[];
  parents: Parent[];
  teachers: Teacher[];
  principals: Principal[];
  attendance: AttendanceRecord[];
  teacherCalls: TeacherCallRequest[];
  managementSupport: ManagementSupportRequest[];
  auditLogs: AuditLog[];
}

const initialStudents: Student[] = [
  {
    id: 'STU001',
    name: 'Aarav',
    role: 'student',
    email: 'aarav@school.edu',
    class: '10A',
    section: 'A',
    parentId: 'PAR001'
  },
  {
    id: 'STU002',
    name: 'Rahul Sharma',
    role: 'student',
    email: 'rahul.sharma@school.edu',
    class: '10A',
    section: 'A',
    parentId: 'PAR002'
  },
  {
    id: 'STU003',
    name: 'Rahul Kumar',
    role: 'student',
    email: 'rahul.kumar@school.edu',
    class: '10B',
    section: 'B',
    parentId: 'PAR003'
  }
];

const initialParents: Parent[] = [
  {
    id: 'PAR001',
    name: 'Priya Sharma',
    role: 'parent',
    email: 'priya@family.com',
    childIds: ['STU001']
  },
  {
    id: 'PAR002',
    name: 'Suresh Sharma',
    role: 'parent',
    email: 'suresh.sharma@family.com',
    childIds: ['STU002']
  },
  {
    id: 'PAR003',
    name: 'Vikram Kumar',
    role: 'parent',
    email: 'vikram.kumar@family.com',
    childIds: ['STU003']
  }
];

const initialTeachers: Teacher[] = [
  {
    id: 'TEA001',
    name: 'Anil Kumar',
    role: 'teacher',
    email: 'anil.kumar@school.edu',
    assignedClass: '10A'
  }
];

const initialPrincipals: Principal[] = [
  {
    id: 'ADM001',
    name: 'Meera Singh',
    role: 'principal',
    email: 'meera.singh@school.edu'
  }
];

// Generate attendance records for past 30 days
// Aarav: 91.2% attendance. Let's make it 91.2%. e.g., 31 days: 28 present, 3 absent = 90.3%
// Let's generate exactly the right status.
// For STU001 (Aarav): 34 records, 31 present, 3 absent (31 / 34 = 91.17% ~ 91.2%)
// For STU002 (Rahul Sharma): 34 records, 30 present, 4 absent (~88.2%)
// For STU003 (Rahul Kumar): 34 records, 29 present, 5 absent (~85.3%)
const generateAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const studentIds = ['STU001', 'STU002', 'STU003'];
  const totalDays = 34;
  const today = new Date('2026-08-20');

  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    
    // Skip weekends
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = d.toISOString().split('T')[0];

    studentIds.forEach(studentId => {
      // Determine status to match targets
      let status: 'present' | 'absent' = 'present';
      if (studentId === 'STU001') {
        // Aarav absent on 3 specific days: Aug 5, Aug 12, Aug 19
        if (['2026-08-05', '2026-08-12', '2026-08-19'].includes(dateStr)) {
          status = 'absent';
        }
      } else if (studentId === 'STU002') {
        // Rahul Sharma absent on: Aug 4, Aug 11, Aug 18
        if (['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-20'].includes(dateStr)) {
          status = 'absent';
        }
      } else {
        // Rahul Kumar absent on: Aug 3, Aug 10, Aug 17, Aug 18
        if (['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-18'].includes(dateStr)) {
          status = 'absent';
        }
      }

      records.push({
        id: `ATT-${studentId}-${dateStr}`,
        studentId,
        date: dateStr,
        status,
        markedBy: 'TEA001',
        timestamp: new Date(dateStr + 'T08:00:00.000Z').toISOString()
      });
    });
  }

  return records;
};

// Global DB definition to avoid wipeouts on Next.js dev hot-reload
const globalForDb = globalThis as unknown as { db: InMemoryDB };

export const db = globalForDb.db || {
  students: initialStudents,
  parents: initialParents,
  teachers: initialTeachers,
  principals: initialPrincipals,
  attendance: generateAttendance(),
  teacherCalls: [],
  managementSupport: [],
  auditLogs: []
};

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

// Reset helper (useful for tests)
export const resetDatabase = () => {
  db.students = [...initialStudents];
  db.parents = [...initialParents];
  db.teachers = [...initialTeachers];
  db.principals = [...initialPrincipals];
  db.attendance = generateAttendance();
  db.teacherCalls = [];
  db.managementSupport = [];
  db.auditLogs = [];
};
