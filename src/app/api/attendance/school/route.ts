import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth/session';
import { checkAuthorization, AuthorizationError } from '../../../../lib/auth/permissions';
import { getSchoolAttendanceService } from '../../../../lib/mock-services';
import { logAudit } from '../../../../lib/security/audit';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    checkAuthorization(session, 'view_school_analytics');

    const analytics = getSchoolAttendanceService();
    return NextResponse.json(analytics);
  } catch (error: any) {
    const isAuthError = error instanceof AuthorizationError;
    const status = isAuthError ? 403 : 400;

    logAudit(
      session.userId,
      session.role,
      'API_GET_SCHOOL_ATTENDANCE_FAILED',
      'getSchoolAttendance',
      false,
      `Error: ${error.message}`
    );

    return NextResponse.json({ error: error.message }, { status });
  }
}
