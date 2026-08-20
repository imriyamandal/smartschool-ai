export type UserRole = 'student' | 'parent' | 'teacher' | 'principal';

export interface BaseUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Student extends BaseUser {
  role: 'student';
  class: string;
  section: string;
  parentId: string; // Associated parent
}

export interface Parent extends BaseUser {
  role: 'parent';
  childIds: string[]; // List of child student IDs
}

export interface Teacher extends BaseUser {
  role: 'teacher';
  assignedClass: string; // e.g. "10A"
}

export interface Principal extends BaseUser {
  role: 'principal';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
  markedBy: string; // Teacher or Principal ID
  timestamp: string; // ISO string
}

export interface TeacherCallRequest {
  id: string;
  studentId: string;
  parentId: string;
  reason: string;
  status: 'submitted' | 'completed';
  timestamp: string;
}

export interface ManagementSupportRequest {
  id: string;
  userId: string;
  userRole: UserRole;
  reason: string;
  status: 'submitted' | 'completed';
  timestamp: string;
}

export interface AuthenticatedSession {
  userId: string;
  name: string;
  role: UserRole;
  studentId?: string; // If student
  parentId?: string;   // If parent
  teacherId?: string;  // If teacher
  permissions: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  role: UserRole;
  action: string;
  tool?: string;
  success: boolean;
  timestamp: string;
  details?: string;
}
