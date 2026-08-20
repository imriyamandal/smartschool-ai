import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth/session';
import { checkAuthorization, AuthorizationError } from '../../../../lib/auth/permissions';
import { createManagementSupportRequestService } from '../../../../lib/mock-services';
import { logAudit } from '../../../../lib/security/audit';
import { z } from 'zod';

const managementSchema = z.object({
  reason: z.string().min(5)
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Session missing.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = managementSchema.parse(body);

    checkAuthorization(session, 'contact_management');

    const result = createManagementSupportRequestService(
      session.userId,
      session.role,
      parsed.reason
    );

    logAudit(
      session.userId,
      session.role,
      'API_MANAGEMENT_SUPPORT_SUCCESS',
      'createManagementSupportRequest',
      true,
      `RequestId: ${result.requestId}`
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
      'API_MANAGEMENT_SUPPORT_FAILED',
      'createManagementSupportRequest',
      false,
      `Error: ${error.message}`
    );

    return NextResponse.json({ error: error.message }, { status });
  }
}
