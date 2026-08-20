import { z } from 'zod';
import { AuthenticatedSession } from '../../types';
import { checkAuthorization, AuthorizationError } from '../auth/permissions';
import { logAudit } from '../security/audit';
import { db } from '../database';
import {
  getStudentAttendanceService,
  getRecentAttendanceService,
  getSchoolAttendanceService,
  markStudentAttendanceService,
  createTeacherCallRequestService,
  createManagementSupportRequestService
} from '../mock-services';

// Define the shape of a tool in the registry
export interface ToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;
  execute: (args: any, session: AuthenticatedSession) => Promise<any>;
}

// 1. getStudentAttendance Tool
const getStudentAttendance: ToolDefinition = {
  name: 'getStudentAttendance',
  description: 'Retrieve the attendance statistics of a student (total, present, absent, percentage).',
  schema: z.object({
    studentId: z.string().min(1, 'studentId is required')
  }),
  execute: async (args, session) => {
    try {
      // Students read via own attendance; teachers/principals via other student attendance
      if (session.role === 'student') {
        checkAuthorization(session, 'view_own_attendance', args.studentId);
      } else {
        checkAuthorization(session, 'view_other_student_attendance', args.studentId);
      }
      
      const result = getStudentAttendanceService(args.studentId);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'getStudentAttendance', true, `Fetched attendance for student: ${args.studentId}`);
      return { success: true, ...result };
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'getStudentAttendance', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 2. getChildAttendance Tool
const getChildAttendance: ToolDefinition = {
  name: 'getChildAttendance',
  description: 'Retrieve the attendance statistics of a parent\'s child student.',
  schema: z.object({
    studentId: z.string().min(1, 'studentId is required')
  }),
  execute: async (args, session) => {
    try {
      checkAuthorization(session, 'view_child_attendance', args.studentId);
      
      const result = getStudentAttendanceService(args.studentId);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'getChildAttendance', true, `Fetched child attendance for student: ${args.studentId}`);
      return { success: true, ...result };
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'getChildAttendance', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 3. getRecentAttendance Tool
const getRecentAttendance: ToolDefinition = {
  name: 'getRecentAttendance',
  description: 'Retrieve the detailed recent attendance logs for a student.',
  schema: z.object({
    studentId: z.string().min(1, 'studentId is required'),
    limit: z.number().int().min(1).max(20).optional().default(5)
  }),
  execute: async (args, session) => {
    try {
      // Validate permissions based on role
      if (session.role === 'student') {
        checkAuthorization(session, 'view_own_attendance', args.studentId);
      } else if (session.role === 'parent') {
        checkAuthorization(session, 'view_child_attendance', args.studentId);
      } else {
        checkAuthorization(session, 'view_other_student_attendance', args.studentId);
      }

      const result = getRecentAttendanceService(args.studentId, args.limit);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'getRecentAttendance', true, `Fetched recent attendance for student: ${args.studentId}`);
      return { success: true, ...result };
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'getRecentAttendance', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 4. markAttendance Tool
const markAttendance: ToolDefinition = {
  name: 'markAttendance',
  description: 'Mark attendance (present/absent) for a student on a specific date.',
  schema: z.object({
    studentId: z.string().min(1, 'studentId is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    status: z.enum(['present', 'absent'])
  }),
  execute: async (args, session) => {
    try {
      checkAuthorization(session, 'mark_attendance', args.studentId);

      const result = markStudentAttendanceService(args.studentId, args.date, args.status, session.userId);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'markAttendance', true, `Marked ${args.studentId} as ${args.status} on ${args.date}`);
      return result;
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'markAttendance', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 5. getSchoolAttendance Tool
const getSchoolAttendance: ToolDefinition = {
  name: 'getSchoolAttendance',
  description: 'Retrieve overall school-wide attendance metrics and class averages.',
  schema: z.object({}),
  execute: async (args, session) => {
    try {
      checkAuthorization(session, 'view_school_analytics');

      const result = getSchoolAttendanceService();
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'getSchoolAttendance', true, 'Fetched school-wide attendance analytics');
      return { success: true, ...result };
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'getSchoolAttendance', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 6. createTeacherCallRequest Tool
const createTeacherCallRequest: ToolDefinition = {
  name: 'createTeacherCallRequest',
  description: 'Request a call or meeting with a teacher regarding a student.',
  schema: z.object({
    studentId: z.string().min(1, 'studentId is required'),
    reason: z.string().min(5, 'Reason must be at least 5 characters long')
  }),
  execute: async (args, session) => {
    try {
      checkAuthorization(session, 'contact_teacher', args.studentId);

      const parentId = session.parentId || '';
      if (!parentId && session.role !== 'principal') {
        throw new Error('Teacher calls must be requested by a parent or manager.');
      }

      // If requested by principal, find the parent of the student to pass in
      let actualParentId = parentId;
      if (session.role === 'principal') {
        const student = db.students.find(s => s.id === args.studentId);
        actualParentId = student?.parentId || '';
      }

      const result = createTeacherCallRequestService(args.studentId, actualParentId, args.reason);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'createTeacherCallRequest', true, `Requested call for child: ${args.studentId} | Request ID: ${result.requestId}`);
      return result;
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'createTeacherCallRequest', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// 7. createManagementSupportRequest Tool
const createManagementSupportRequest: ToolDefinition = {
  name: 'createManagementSupportRequest',
  description: 'Request support or escalate an issue to school management/principal.',
  schema: z.object({
    reason: z.string().min(5, 'Reason must be at least 5 characters long')
  }),
  execute: async (args, session) => {
    try {
      checkAuthorization(session, 'contact_management');

      const result = createManagementSupportRequestService(session.userId, session.role, args.reason);
      logAudit(session.userId, session.role, 'EXECUTE_TOOL_SUCCESS', 'createManagementSupportRequest', true, `Submitted management escalation | Request ID: ${result.requestId}`);
      return result;
    } catch (error: any) {
      const isAuthError = error instanceof AuthorizationError;
      logAudit(session.userId, session.role, isAuthError ? 'EXECUTE_TOOL_UNAUTHORIZED' : 'EXECUTE_TOOL_FAILED', 'createManagementSupportRequest', false, error.message);
      return { success: false, error: isAuthError ? 'UNAUTHORIZED' : error.message };
    }
  }
};

// Expose the tools registry
export const toolsRegistry: Record<string, ToolDefinition> = {
  getStudentAttendance,
  getChildAttendance,
  getRecentAttendance,
  markAttendance,
  getSchoolAttendance,
  createTeacherCallRequest,
  createManagementSupportRequest
};

/**
 * Execute a tool securely after checking authentication and arguments schema.
 */
export const executeToolSecurely = async (
  toolName: string,
  args: any,
  session: AuthenticatedSession
): Promise<any> => {
  const tool = toolsRegistry[toolName];
  if (!tool) {
    logAudit(session.userId, session.role, 'EXECUTE_TOOL_NOT_FOUND', toolName, false, `Tool not found in registry`);
    return { success: false, error: `Tool ${toolName} not found.` };
  }

  // Schema verification
  const parseResult = tool.schema.safeParse(args);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    logAudit(session.userId, session.role, 'EXECUTE_TOOL_SCHEMA_INVALID', toolName, false, errorDetails);
    return { success: false, error: `Invalid arguments: ${errorDetails}` };
  }

  return await tool.execute(parseResult.data, session);
};
