import { NextResponse } from 'next/server';
import { getAuditLogs } from '../../../lib/security/audit';

export async function GET() {
  // Return the latest audit logs from the in-memory database
  return NextResponse.json({ logs: getAuditLogs() });
}
