import { db } from '../database';
import { UserRole, AuditLog } from '../../types';

export const logAudit = (
  userId: string,
  role: UserRole,
  action: string,
  tool: string | undefined,
  success: boolean,
  details?: string
): AuditLog => {
  const log: AuditLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    role,
    action,
    tool,
    success,
    timestamp: new Date().toISOString(),
    details
  };

  db.auditLogs.unshift(log); // Add to the beginning of the logs

  // Keep logs at a reasonable limit (e.g. 500 records)
  if (db.auditLogs.length > 500) {
    db.auditLogs.pop();
  }

  // Console output as developer-friendly observability log
  const emoji = success ? '✅' : '❌';
  console.log(`[AUDIT] ${emoji} [User: ${userId} (${role})] Action: ${action} | Tool: ${tool || 'None'} | Success: ${success}${details ? ` | Details: ${details}` : ''}`);

  return log;
};

export const getAuditLogs = (): AuditLog[] => {
  return db.auditLogs;
};
