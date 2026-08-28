import { query, queryOne } from '../db';
import { logger } from '../logger';
import type { Paginated } from '@/types/models';
import { paginate } from '@/types/models';

/**
 * Append-only audit trail (§3). Recording a trail entry must never fail the
 * operation it describes, so write errors are logged and swallowed.
 */

export interface AuditEntry {
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}

export async function record(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        entry.actorId,
        entry.actorEmail,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        JSON.stringify(entry.changes ?? {}),
        entry.ipAddress ?? null,
      ],
    );
  } catch (error) {
    logger.error('Failed to write audit entry', {
      action: entry.action,
      entityType: entry.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function list(options: {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  actorId?: string;
}): Promise<Paginated<AuditRow>> {
  const conditions = ['1 = 1'];
  const params: unknown[] = [];

  for (const [column, value] of [
    ['action', options.action],
    ['entity_type', options.entityType],
    ['actor_id', options.actorId],
  ] as const) {
    if (!value) continue;
    params.push(value);
    conditions.push(`${column} = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (options.page - 1) * options.pageSize;
  params.push(options.pageSize, offset);

  const { rows } = await query<AuditRow>(
    `SELECT id, actor_id, actor_email, action, entity_type, entity_id, changes,
            host(ip_address) AS ip_address, created_at
       FROM audit_log ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = await queryOne<{ count: string }>(
    `SELECT count(*)::text AS count FROM audit_log ${where}`,
    params.slice(0, -2),
  );

  return paginate(rows, Number(total?.count ?? 0), options.page, options.pageSize);
}

/** Audit action names, kept in one place so filters and writes cannot drift. */
export const AUDIT_ACTIONS = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  INVESTOR_CONTENT_APPROVED: 'project.investor_content.approved',
  INVESTOR_CONTENT_REVOKED: 'project.investor_content.revoked',
  MILESTONE_CREATED: 'passport.milestone.created',
  MILESTONE_UPDATED: 'passport.milestone.updated',
  MILESTONE_DELETED: 'passport.milestone.deleted',
  TOUR_CREATED: 'tour.created',
  TOUR_DELETED: 'tour.deleted',
  NEWS_CREATED: 'news.created',
  NEWS_UPDATED: 'news.updated',
  NEWS_DELETED: 'news.deleted',
  USER_CREATED: 'user.created',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_DELETED: 'user.deleted',
  USER_DATA_EXPORTED: 'user.data_exported',
  FORM_SPAM_FLAGGED: 'form.spam_flagged',
  LOGIN_SUCCEEDED: 'auth.login_succeeded',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
} as const;
