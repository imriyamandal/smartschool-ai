import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth/session';
import { checkAuthorization, AuthorizationError } from '../../../../../lib/auth/permissions';
import { getStudentAttendanceService } from '../../../../../lib/mock-services';
import { logAudit } from '../../../../../lib/security/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    // Validate authorization
    if (session.role === 'student') {
      checkAuthorization(session, 'view_own_attendance', id);
    } else {
      checkAuthorization(session, 'view_other_student_attendance', id);
    }

    const attendance = getStudentAttendanceService(id);
    return NextResponse.json(attendance);
  } catch (error: any) {
    const isAuthError = error instanceof AuthorizationError;
    const status = isAuthError ? 403 : 400;
    
    logAudit(
      session?.userId || 'unknown',
      session?.role || 'student',
      'API_GET_STUDENT_ATTENDANCE_FAILED',
      'getStudentAttendance',
      false,
      `StudentId: ${id} | Error: ${error.message}`
    );

    return NextResponse.json({ error: error.message }, { status });
  }
}
