import { NextResponse } from 'next/server';
import { getSession, setSessionCookie, clearSessionCookie, demoUsers, getPermissionsForRole } from '../../../../lib/auth/session';
import { logAudit } from '../../../../lib/security/audit';
import { UserRole, AuthenticatedSession } from '../../../../types';

export async function GET() {
  const session = await getSession();
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  try {
    const { role } = await request.json();
    
    if (!role || !['student', 'parent', 'teacher', 'principal'].includes(role)) {
      return NextResponse.json({ error: 'Invalid or missing role' }, { status: 400 });
    }

    const userDetails = demoUsers[role as UserRole];
    
    const session: AuthenticatedSession = {
      userId: userDetails.userId,
      name: userDetails.name,
      role: role as UserRole,
      studentId: role === 'student' ? 'STU001' : undefined,
      parentId: role === 'parent' ? 'PAR001' : undefined,
      teacherId: role === 'teacher' ? 'TEA001' : undefined,
      permissions: getPermissionsForRole(role as UserRole)
    };

    await setSessionCookie(session);
    logAudit(session.userId, session.role, 'USER_LOGIN_DEMO', undefined, true, `Logged in as ${session.name} (${session.role})`);

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (session) {
    logAudit(session.userId, session.role, 'USER_LOGOUT_DEMO', undefined, true, `Logged out`);
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
