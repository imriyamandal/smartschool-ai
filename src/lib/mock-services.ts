import { db } from './database';
import { AttendanceRecord, TeacherCallRequest, ManagementSupportRequest } from '../types';

export const getStudentAttendanceService = (studentId: string) => {
  const student = db.students.find(s => s.id === studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  const records = db.attendance.filter(r => r.studentId === studentId);
  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100.0;

  return {
    studentId,
    studentName: student.name,
    class: student.class,
    section: student.section,
    totalRecords: total,
    presentCount: present,
    absentCount: total - present,
    percentage
  };
};

export const getRecentAttendanceService = (studentId: string, limit: number = 5) => {
  const student = db.students.find(s => s.id === studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  const records = db.attendance
    .filter(r => r.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return {
    studentId,
    studentName: student.name,
    records: records.map(r => ({
      date: r.date,
      status: r.status,
      markedBy: r.markedBy
    }))
  };
};

export const getSchoolAttendanceService = () => {
  // Overall statistics
  const totalRecords = db.attendance.length;
  const presentRecords = db.attendance.filter(r => r.status === 'present').length;
  const overallPercentage = totalRecords > 0 ? parseFloat(((presentRecords / totalRecords) * 100).toFixed(1)) : 100.0;

  // Group by classes
  const classes = Array.from(new Set(db.students.map(s => s.class)));
  const classAverages = classes.map(cls => {
    const classStudentIds = db.students.filter(s => s.class === cls).map(s => s.id);
    const classRecords = db.attendance.filter(r => classStudentIds.includes(r.studentId));
    const total = classRecords.length;
    const present = classRecords.filter(r => r.status === 'present').length;
    const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100.0;

    return {
      class: cls,
      total,
      present,
      percentage
    };
  });

  return {
    overallPercentage,
    totalRecords,
    presentRecords,
    absentRecords: totalRecords - presentRecords,
    classAverages
  };
};

export const markStudentAttendanceService = (
  studentId: string,
  date: string,
  status: 'present' | 'absent',
  markedBy: string
) => {
  const student = db.students.find(s => s.id === studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format ${date}. Must be YYYY-MM-DD.`);
  }

  const existingIndex = db.attendance.findIndex(r => r.studentId === studentId && r.date === date);

  const record: AttendanceRecord = {
    id: existingIndex >= 0 ? db.attendance[existingIndex].id : `ATT-${studentId}-${date}`,
    studentId,
    date,
    status,
    markedBy,
    timestamp: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    db.attendance[existingIndex] = record;
  } else {
    db.attendance.push(record);
  }

  return {
    success: true,
    record
  };
};

export const createTeacherCallRequestService = (studentId: string, parentId: string, reason: string) => {
  const student = db.students.find(s => s.id === studentId);
  if (!student) {
    throw new Error(`Student with ID ${studentId} not found.`);
  }

  const parent = db.parents.find(p => p.id === parentId);
  if (!parent) {
    throw new Error(`Parent with ID ${parentId} not found.`);
  }

  // Verify child-parent relationship
  if (!parent.childIds.includes(studentId)) {
    throw new Error(`Student ${studentId} is not a child of parent ${parentId}.`);
  }

  const id = `CALL-${1000 + db.teacherCalls.length + 1}`;
  const request: TeacherCallRequest = {
    id,
    studentId,
    parentId,
    reason,
    status: 'submitted',
    timestamp: new Date().toISOString()
  };

  db.teacherCalls.push(request);

  return {
    success: true,
    requestId: id,
    status: 'submitted',
    request
  };
};

export const createManagementSupportRequestService = (userId: string, userRole: any, reason: string) => {
  const id = `MGMT-${1000 + db.managementSupport.length + 1}`;
  const request: ManagementSupportRequest = {
    id,
    userId,
    userRole,
    reason,
    status: 'submitted',
    timestamp: new Date().toISOString()
  };

  db.managementSupport.push(request);

  return {
    success: true,
    requestId: id,
    status: 'submitted',
    request
  };
};
