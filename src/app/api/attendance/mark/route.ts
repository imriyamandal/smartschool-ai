import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth/session';
import { checkAuthorization, AuthorizationError } from '../../../../lib/auth/permissions';
import { markStudentAttendanceService } from '../../../../lib/mock-services';
import { logAudit } from '../../../../lib/security/audit';
import { z } from 'zod';

const markSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'absent'])
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = markSchema.parse(body);

    // Verify permission on server-side
    checkAuthorization(session, 'mark_attendance', parsed.studentId);

    const result = markStudentAttendanceService(
      parsed.studentId,
      parsed.date,
      parsed.status,
      session.userId
    );

    logAudit(
      session.userId,
      session.role,
      'API_MARK_ATTENDANCE_SUCCESS',
      'markAttendance',
      true,
      `StudentId: ${parsed.studentId} | Date: ${parsed.date} | Status: ${parsed.status}`
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid arguments', details: error.issues }, { status: 400 });
    }
    
    const isAuthError = error instanceof AuthorizationError;
    const status = isAuthError ? 403 : 400;

    logAudit(
      session.userId,
      session.role,
      'API_MARK_ATTENDANCE_FAILED',
      'markAttendance',
      false,
      `Error: ${error.message}`
    );

    return NextResponse.json({ error: error.message }, { status });
  }
}
