import { AuthenticatedSession, UserRole } from '../../types';
import { db } from '../database';

export class AuthorizationError extends Error {
  constructor(message: string = 'Access denied. Unauthorized.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export type PermissionCapability =
  | 'view_own_attendance'
  | 'view_child_attendance'
  | 'view_other_student_attendance'
  | 'mark_attendance'
  | 'view_school_analytics'
  | 'contact_teacher'
  | 'contact_management';

/**
 * Validates whether the authenticated session has permission to perform a capability on a specific resource.
 * Throws AuthorizationError if unauthorized.
 */
export const checkAuthorization = (
  session: AuthenticatedSession | null,
  capability: PermissionCapability,
  targetStudentId?: string
): void => {
  if (!session) {
    throw new AuthorizationError('Authentication required.');
  }

  const { role, userId, studentId, parentId, teacherId } = session;

  switch (capability) {
    case 'view_own_attendance': {
      // Students can view their own attendance.
      // Teachers and Principals can view their own profiles, but if checking a student attendance,
      // it must be checked via view_other_student_attendance.
      if (role === 'student') {
        if (studentId !== targetStudentId) {
          throw new AuthorizationError('Students can only view their own attendance.');
        }
        return;
      }
      if (role === 'teacher' || role === 'principal') {
        return; // Authorized
      }
      throw new AuthorizationError('Unauthorized to view own attendance.');
    }

    case 'view_child_attendance': {
      if (role === 'principal') return; // Principals can view child attendance
      if (role === 'parent') {
        if (!targetStudentId) {
          throw new AuthorizationError('Target student ID must be specified.');
        }
        const parent = db.parents.find(p => p.id === parentId);
        if (!parent || !parent.childIds.includes(targetStudentId)) {
          throw new AuthorizationError('Parents can only view their own children\'s attendance.');
        }
        return;
      }
      throw new AuthorizationError('Only parents and principals can view child attendance.');
    }

    case 'view_other_student_attendance': {
      if (role === 'principal') return; // Principals can view any student
      if (role === 'teacher') {
        if (!targetStudentId) {
          throw new AuthorizationError('Target student ID must be specified.');
        }
        // Verify student is in teacher's assigned class
        const teacher = db.teachers.find(t => t.id === teacherId);
        const student = db.students.find(s => s.id === targetStudentId);
        if (!teacher || !student || student.class !== teacher.assignedClass) {
          throw new AuthorizationError(`Teachers can only view students in their assigned class (${teacher?.assignedClass || 'none'}).`);
        }
        return;
      }
      throw new AuthorizationError('Unauthorized to view other students\' attendance.');
    }

    case 'mark_attendance': {
      if (role === 'principal') return;
      if (role === 'teacher') {
        if (!targetStudentId) {
          throw new AuthorizationError('Target student ID must be specified.');
        }
        // Verify student is in teacher's assigned class
        const teacher = db.teachers.find(t => t.id === teacherId);
        const student = db.students.find(s => s.id === targetStudentId);
        if (!teacher || !student || student.class !== teacher.assignedClass) {
          throw new AuthorizationError(`Teachers can only mark attendance for students in their assigned class (${teacher?.assignedClass || 'none'}).`);
        }
        return;
      }
      throw new AuthorizationError('Only teachers and principals can mark attendance.');
    }

    case 'view_school_analytics': {
      if (role === 'principal') return;
      if (role === 'teacher') {
        // Teachers have limited analytics, but can fetch overall metrics.
        // Let's grant them access to analytics for class comparisons.
        return;
      }
      throw new AuthorizationError('Access denied: Principal or teacher role required for school analytics.');
    }

    case 'contact_teacher': {
      if (role === 'principal') return;
      if (role === 'student') {
        if (studentId !== targetStudentId) {
          throw new AuthorizationError('Students can only contact teachers for themselves.');
        }
        return;
      }
      if (role === 'parent') {
        if (!targetStudentId) {
          throw new AuthorizationError('Target student ID must be specified.');
        }
        const parent = db.parents.find(p => p.id === parentId);
        if (!parent || !parent.childIds.includes(targetStudentId)) {
          throw new AuthorizationError('Parents can only contact teachers for their own children.');
        }
        return;
      }
      throw new AuthorizationError('Unauthorized to contact teachers.');
    }

    case 'contact_management': {
      // Parents, teachers, principals can contact management. Students cannot.
      if (role === 'parent' || role === 'teacher' || role === 'principal' || role === 'student') {
        return; // Wait, parent, teacher, principal and student can contact management. Let's look at page 10: Contact management: Student: YES, Parent: YES, Teacher: YES, Principal: YES.
      }
      return;
    }

    default:
      throw new AuthorizationError('Unknown capability requested.');
  }
};
