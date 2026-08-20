import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth/session';
import { checkAuthorization, AuthorizationError } from '../../../../lib/auth/permissions';
import { createTeacherCallRequestService } from '../../../../lib/mock-services';
import { logAudit } from '../../../../lib/security/audit';
import { db } from '../../../../lib/database';
import { z } from 'zod';

const callSchema = z.object({
  studentId: z.string().min(1),
  reason: z.string().min(5)
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = callSchema.parse(body);

    checkAuthorization(session, 'contact_teacher', parsed.studentId);

    const parentId = session.parentId || '';
    if (!parentId && session.role !== 'principal') {
      return NextResponse.json({ error: 'Call requests must be made by a parent or manager.' }, { status: 400 });
    }

    // Resolve parent ID for managers
    let actualParentId = parentId;
    if (session.role === 'principal') {
      const student = db.students.find(s => s.id === parsed.studentId);
      actualParentId = student?.parentId || '';
    }

    const result = createTeacherCallRequestService(parsed.studentId, actualParentId, parsed.reason);

    logAudit(
      session.userId,
      session.role,
      'API_TEACHER_CALL_SUCCESS',
      'createTeacherCallRequest',
      true,
      `StudentId: ${parsed.studentId} | RequestId: ${result.requestId}`
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
      'API_TEACHER_CALL_FAILED',
      'createTeacherCallRequest',
      false,
      `Error: ${error.message}`
    );

    return NextResponse.json({ error: error.message }, { status });
  }
}
