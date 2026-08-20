import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AuthenticatedSession, UserRole } from '../../types';

const configuredSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
}

const SECRET_KEY = new TextEncoder().encode(
  configuredSecret || 'development_only_session_secret_at_least_32_characters'
);

export const signSession = async (session: AuthenticatedSession): Promise<string> => {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(SECRET_KEY);
};

export const verifySession = async (token: string): Promise<AuthenticatedSession | null> => {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
    });
    return payload as unknown as AuthenticatedSession;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
};

export const getSession = async (): Promise<AuthenticatedSession | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_session')?.value;
    if (!token) return null;
    return await verifySession(token);
  } catch (error) {
    console.error('Failed to get session from cookies:', error);
    return null;
  }
};

export const setSessionCookie = async (session: AuthenticatedSession) => {
  const token = await signSession(session);
  const cookieStore = await cookies();
  cookieStore.set('auth_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2 // 2 hours
  });
};

export const clearSessionCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete('auth_session');
};

// Default sessions mapped for demo selection
export const demoUsers: Record<UserRole, { userId: string; name: string; details: string }> = {
  student: {
    userId: 'STU001',
    name: 'Aarav',
    details: 'Student ID: STU001 | Class: 10A'
  },
  parent: {
    userId: 'PAR001',
    name: 'Priya Sharma',
    details: 'Parent ID: PAR001 | Child: STU001 (Aarav)'
  },
  teacher: {
    userId: 'TEA001',
    name: 'Anil Kumar',
    details: 'Teacher ID: TEA001 | Assigned Class: 10A'
  },
  principal: {
    userId: 'ADM001',
    name: 'Meera Singh',
    details: 'Principal ID: ADM001 | Full School Access'
  }
};

export const getPermissionsForRole = (role: UserRole): string[] => {
  switch (role) {
    case 'student':
      return ['own_attendance_read', 'teacher_contact'];
    case 'parent':
      return ['child_attendance_read', 'teacher_contact', 'management_contact'];
    case 'teacher':
      return ['own_attendance_read', 'class_attendance_read', 'attendance_write', 'management_contact'];
    case 'principal':
      return [
        'own_attendance_read',
        'child_attendance_read',
        'class_attendance_read',
        'school_attendance_read',
        'attendance_write',
        'teacher_contact',
        'management_contact'
      ];
    default:
      return [];
  }
};
