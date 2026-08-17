import type { Logger } from './logger';

// Canonical security-event log schema (SOC 2 CC7.2). Emit these for
// auth, admin, and access-control events so monitoring/alerting can key off
// stable fields (`event: 'security'`, `action`, `outcome`) instead of parsing
// free-text messages. `warn` for failures/denials, `info` for successes.

export type SecurityAction =
	| 'auth.login'
	| 'auth.logout'
	| 'auth.register'
	| 'auth.password_change'
	| 'auth.mfa_verify'
	| 'auth.token_refresh'
	| 'authz.permission_denied'
	| 'admin.action'
	| 'account.deleted'
	| 'account.suspended';

export interface ISecurityEvent {
	action: SecurityAction;
	outcome: 'success' | 'failure' | 'denied';
	actorId?: string | null;
	workspaceId?: string | null;
	requestId?: string;
	ip?: string;
	// Extra, non-sensitive detail. Never put secrets/tokens/PII here.
	detail?: Record<string, unknown>;
}

// Log a security event through the given logger with the canonical shape.
export function logSecurityEvent(logger: Logger, evt: ISecurityEvent): void {
	const context: Record<string, unknown> = {
		event: 'security',
		action: evt.action,
		outcome: evt.outcome,
		actorId: evt.actorId ?? null,
		workspaceId: evt.workspaceId ?? null,
		...(evt.requestId ? { requestId: evt.requestId } : {}),
		...(evt.ip ? { ip: evt.ip } : {}),
		...(evt.detail ? { detail: evt.detail } : {}),
	};
	const message = `security ${evt.action} ${evt.outcome}`;
	if (evt.outcome === 'success') logger.info(message, context);
	else logger.warn(message, context);
}
