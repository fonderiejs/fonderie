import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { AdminScope } from '../types';
import {
	type ISecretBox,
	dummyHash,
	hashPassword,
	newBackupCodes,
	newOpaqueToken,
	newTotpSecret,
	normalizeBackupCode,
	sha256,
	verifyPassword,
	verifyTotp,
} from './crypto';

// Session policy. Short on purpose: this is the surface that can reveal every
// secret the app holds.
export const IDLE_MS = 30 * 60_000; // signed out after 30 minutes untouched
export const ABSOLUTE_MS = 12 * 3_600_000; // and after 12 hours regardless
export const PENDING_MS = 10 * 60_000; // password checked, code not yet: 10 minutes
export const STEP_UP_MS = 5 * 60_000; // a fresh code covers dangerous actions for 5 minutes
export const INVITE_HOURS = 72;
export const RECOVERY_HOURS = 24;
export const MAX_FAILURES = 5; // then locked, doubling from 1 minute, capped at an hour

export type SessionStage = 'password' | 'enroll' | 'active';

export interface IOperatorRow {
	id: string;
	email: string;
	name: string | null;
	passwordHash: string;
	scopes: AdminScope[];
	totpSecret: string | null;
	totpConfirmedAt: string | null;
	totpLastStep: string | null; // BIGINT arrives as a string
	backupCodes: string[];
	failedAttempts: number;
	lockedUntil: string | null;
	createdBy: string;
	createdAt: string;
	lastLoginAt: string | null;
	disabledAt: string | null;
}

export interface ISessionRow {
	idHash: string;
	operatorId: string;
	stage: SessionStage;
	createdAt: string;
	lastSeenAt: string;
	expiresAt: string;
	stepUpAt: string | null;
}

const OP_COLS = `id, email, name, password_hash AS "passwordHash", scopes, totp_secret AS "totpSecret",
  totp_confirmed_at AS "totpConfirmedAt", totp_last_step AS "totpLastStep", backup_codes AS "backupCodes",
  failed_attempts AS "failedAttempts", locked_until AS "lockedUntil", created_by AS "createdBy",
  created_at AS "createdAt", last_login_at AS "lastLoginAt", disabled_at AS "disabledAt"`;

const SESSION_COLS = `id_hash AS "idHash", operator_id AS "operatorId", stage, created_at AS "createdAt",
  last_seen_at AS "lastSeenAt", expires_at AS "expiresAt", step_up_at AS "stepUpAt"`;

export const normalizeEmail = (e: string): string => e.trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── operators ──────────────────────────────────────────────────────────────

export async function operatorCount(store: IStoreAdapter): Promise<number> {
	const [row] = await store.query<{ n: string }>(
		`SELECT count(*)::text AS n FROM fonderie_admin_operators`,
	);
	return Number(row?.n ?? 0);
}

export async function findOperator(
	store: IStoreAdapter,
	by: { id?: string; email?: string },
): Promise<IOperatorRow | null> {
	const [row] = by.id
		? await store.query<IOperatorRow>(
				`SELECT ${OP_COLS} FROM fonderie_admin_operators WHERE id = $1`,
				[by.id],
			)
		: await store.query<IOperatorRow>(
				`SELECT ${OP_COLS} FROM fonderie_admin_operators WHERE email = $1`,
				[normalizeEmail(by.email ?? '')],
			);
	return row ?? null;
}

/**
 * The one-time claim: creates the first operator, with every scope, only while
 * none exists. Serialized with an advisory lock so two simultaneous claims
 * cannot both succeed.
 */
export async function claimFirstOperator(
	store: IStoreAdapter,
	input: { email: string; name?: string | undefined; password: string },
): Promise<IOperatorRow | null> {
	const passwordHash = await hashPassword(input.password);
	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext('fonderie_admin_claim'))`);
		const [row] = await tx.query<IOperatorRow>(
			`INSERT INTO fonderie_admin_operators (email, name, password_hash, scopes, created_by)
			 SELECT $1, $2, $3, $4, 'claim'
			  WHERE NOT EXISTS (SELECT 1 FROM fonderie_admin_operators)
			 RETURNING ${OP_COLS}`,
			[normalizeEmail(input.email), input.name ?? null, passwordHash, ['read', 'write', 'secrets']],
		);
		return row ?? null;
	});
}

export async function recordFailure(store: IStoreAdapter, id: string): Promise<void> {
	// Past the limit, lock for 2^(n-limit) minutes, capped at an hour.
	await store.query(
		`UPDATE fonderie_admin_operators
		    SET failed_attempts = failed_attempts + 1,
		        locked_until = CASE WHEN failed_attempts + 1 >= $2
		          THEN now() + make_interval(mins => LEAST(60, power(2, failed_attempts + 1 - $2)::int))
		          ELSE locked_until END
		  WHERE id = $1`,
		[id, MAX_FAILURES],
	);
}

export const isLocked = (op: IOperatorRow): boolean =>
	op.lockedUntil !== null && new Date(op.lockedUntil).getTime() > Date.now();

export function lockMinutes(op: IOperatorRow): number {
	return op.lockedUntil
		? Math.max(1, Math.ceil((new Date(op.lockedUntil).getTime() - Date.now()) / 60_000))
		: 0;
}

/** Password check that costs the same whether or not the email exists. */
export async function checkPassword(store: IStoreAdapter, email: string, password: string) {
	const op = await findOperator(store, { email });
	if (!op) {
		await verifyPassword(password, await dummyHash());
		return { op: null, ok: false } as const;
	}
	if (op.disabledAt) {
		await verifyPassword(password, await dummyHash());
		return { op: null, ok: false } as const;
	}
	if (isLocked(op)) return { op, ok: false, locked: true } as const;
	const ok = await verifyPassword(password, op.passwordHash);
	if (!ok) await recordFailure(store, op.id);
	return { op, ok } as const;
}

/** A time-step or a backup code. Consumes the backup code; records the step. */
export async function checkSecondFactor(
	store: IStoreAdapter,
	box: ISecretBox,
	op: IOperatorRow,
	input: { code?: unknown; backupCode?: unknown },
): Promise<{ ok: boolean; via?: 'totp' | 'backup'; backupLeft?: number }> {
	if (isLocked(op)) return { ok: false };
	if (typeof input.code === 'string' && op.totpSecret) {
		const last = op.totpLastStep === null ? null : Number(op.totpLastStep);
		const step = verifyTotp(box.open(op.totpSecret), input.code, last);
		if (step !== null) {
			// Conditional on the step still being newer: two requests racing with
			// the same code cannot both pass.
			const rows = await store.query(
				`UPDATE fonderie_admin_operators SET totp_last_step = $2, failed_attempts = 0, locked_until = NULL
				  WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING id`,
				[op.id, step],
			);
			if (rows.length) return { ok: true, via: 'totp' };
		}
	} else if (typeof input.backupCode === 'string') {
		const h = sha256(normalizeBackupCode(input.backupCode));
		const [row] = await store.query<{ left: number | null }>(
			`UPDATE fonderie_admin_operators
			    SET backup_codes = array_remove(backup_codes, $2), failed_attempts = 0, locked_until = NULL
			  WHERE id = $1 AND $2 = ANY(backup_codes)
			  RETURNING coalesce(array_length(backup_codes, 1), 0) AS left`,
			[op.id, h],
		);
		if (row) return { ok: true, via: 'backup', backupLeft: Number(row.left ?? 0) };
	}
	await recordFailure(store, op.id);
	return { ok: false };
}

/** The secret to show while enrolling. Created once, kept until confirmed. */
export async function enrollmentSecret(
	store: IStoreAdapter,
	box: ISecretBox,
	op: IOperatorRow,
): Promise<string> {
	if (op.totpSecret && !op.totpConfirmedAt) return box.open(op.totpSecret);
	const secret = newTotpSecret();
	await store.query(
		`UPDATE fonderie_admin_operators SET totp_secret = $2 WHERE id = $1 AND totp_confirmed_at IS NULL`,
		[op.id, box.seal(secret)],
	);
	return secret;
}

export async function confirmEnrollment(
	store: IStoreAdapter,
	box: ISecretBox,
	op: IOperatorRow,
	code: string,
): Promise<string[] | null> {
	if (!op.totpSecret || op.totpConfirmedAt || isLocked(op)) return null;
	const step = verifyTotp(box.open(op.totpSecret), code, null);
	if (step === null) {
		await recordFailure(store, op.id);
		return null;
	}
	const codes = newBackupCodes();
	await store.query(
		`UPDATE fonderie_admin_operators
		    SET totp_confirmed_at = now(), totp_last_step = $2, backup_codes = $3,
		        failed_attempts = 0, locked_until = NULL, last_login_at = now()
		  WHERE id = $1`,
		[op.id, step, codes.map((c) => sha256(normalizeBackupCode(c)))],
	);
	return codes;
}

export async function listOperators(store: IStoreAdapter) {
	const operators = await store.query<IOperatorRow>(
		`SELECT ${OP_COLS} FROM fonderie_admin_operators ORDER BY created_at`,
	);
	const links = await store.query<{
		id: string;
		kind: string;
		email: string;
		scopes: AdminScope[];
		createdBy: string;
		createdAt: string;
		expiresAt: string;
	}>(
		`SELECT id, kind, email, scopes, created_by AS "createdBy", created_at AS "createdAt", expires_at AS "expiresAt"
		   FROM fonderie_admin_invites WHERE used_at IS NULL AND expires_at > now() ORDER BY created_at DESC`,
	);
	return { operators: operators.map(publicOperator), links };
}

/** What the API ever says about an operator: never a hash, secret or code. */
export function publicOperator(op: IOperatorRow) {
	return {
		id: op.id,
		email: op.email,
		name: op.name,
		scopes: op.scopes,
		enrolled: op.totpConfirmedAt !== null,
		backupCodesLeft: op.backupCodes.length,
		locked: isLocked(op),
		createdBy: op.createdBy,
		createdAt: op.createdAt,
		lastLoginAt: op.lastLoginAt,
		disabledAt: op.disabledAt,
	};
}

// ── links (invite / recovery) ──────────────────────────────────────────────

export async function createLink(
	store: IStoreAdapter,
	input: {
		kind: 'invite' | 'recovery';
		email: string;
		scopes?: AdminScope[];
		operatorId?: string;
		createdBy: string;
		hours: number;
	},
): Promise<{ id: string; token: string; expiresAt: string }> {
	const token = newOpaqueToken(input.kind === 'invite' ? 'fai' : 'far');
	if (input.operatorId) {
		// A new recovery link retires any earlier one for the same operator.
		await store.query(
			`UPDATE fonderie_admin_invites SET used_at = now() WHERE operator_id = $1 AND used_at IS NULL`,
			[input.operatorId],
		);
	}
	const [row] = await store.query<{ id: string; expiresAt: string }>(
		`INSERT INTO fonderie_admin_invites (kind, token_hash, email, scopes, operator_id, created_by, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(hours => $7)) RETURNING id, expires_at AS "expiresAt"`,
		[
			input.kind,
			sha256(token),
			normalizeEmail(input.email),
			input.scopes ?? [],
			input.operatorId ?? null,
			input.createdBy,
			input.hours,
		],
	);
	if (!row) throw new Error('[admin] link insert returned no row');
	return { id: row.id, token, expiresAt: row.expiresAt };
}

export async function findLink(store: IStoreAdapter, token: string) {
	const [row] = await store.query<{
		id: string;
		kind: 'invite' | 'recovery';
		email: string;
		scopes: AdminScope[];
		operatorId: string | null;
		createdBy: string;
	}>(
		`SELECT id, kind, email, scopes, operator_id AS "operatorId", created_by AS "createdBy"
		   FROM fonderie_admin_invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
		[sha256(token)],
	);
	return row ?? null;
}

/**
 * Redeem a link: an invite creates the operator, a recovery resets password and
 * second factor. Single-use, atomically. Returns the operator, or a reason.
 */
export async function redeemLink(
	store: IStoreAdapter,
	token: string,
	input: { password: string; name?: string | undefined },
): Promise<{ op: IOperatorRow } | { error: 'INVALID_LINK' | 'ALREADY_OPERATOR' }> {
	const passwordHash = await hashPassword(input.password);
	return store
		.transaction(async (tx) => {
			const [link] = await tx.query<{
				kind: string;
				email: string;
				scopes: AdminScope[];
				operatorId: string | null;
				createdBy: string;
			}>(
				`UPDATE fonderie_admin_invites SET used_at = now()
			  WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
			  RETURNING kind, email, scopes, operator_id AS "operatorId", created_by AS "createdBy"`,
				[sha256(token)],
			);
			if (!link) return { error: 'INVALID_LINK' as const };
			if (link.kind === 'invite') {
				const [op] = await tx.query<IOperatorRow>(
					`INSERT INTO fonderie_admin_operators (email, name, password_hash, scopes, created_by)
				 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING RETURNING ${OP_COLS}`,
					[link.email, input.name ?? null, passwordHash, link.scopes, link.createdBy],
				);
				if (!op)
					throw Object.assign(new Error('already an operator'), { code: 'ALREADY_OPERATOR' });
				return { op };
			}
			const [op] = await tx.query<IOperatorRow>(
				`UPDATE fonderie_admin_operators
			    SET password_hash = $2, totp_secret = NULL, totp_confirmed_at = NULL, totp_last_step = NULL,
			        backup_codes = '{}', failed_attempts = 0, locked_until = NULL
			  WHERE id = $1 AND disabled_at IS NULL RETURNING ${OP_COLS}`,
				[link.operatorId, passwordHash],
			);
			if (!op) return { error: 'INVALID_LINK' as const };
			await tx.query(`DELETE FROM fonderie_admin_sessions WHERE operator_id = $1`, [op.id]);
			return { op };
		})
		.catch((err: unknown) => {
			if ((err as { code?: string }).code === 'ALREADY_OPERATOR')
				return { error: 'ALREADY_OPERATOR' as const };
			throw err;
		});
}

// ── sessions ───────────────────────────────────────────────────────────────

export async function createSession(
	store: IStoreAdapter,
	ctx: IFonderieContext,
	operatorId: string,
	stage: SessionStage,
): Promise<string> {
	const id = newOpaqueToken('fas');
	const ttl = stage === 'active' ? ABSOLUTE_MS : PENDING_MS;
	await store.query(
		`INSERT INTO fonderie_admin_sessions (id_hash, operator_id, stage, expires_at, client_ip, user_agent)
		 VALUES ($1, $2, $3, now() + make_interval(secs => $4), $5, $6)`,
		[
			sha256(id),
			operatorId,
			stage,
			ttl / 1000,
			ctx.meta.clientIp ?? null,
			ctx.request.headers.get('user-agent')?.slice(0, 300) ?? null,
		],
	);
	return id;
}

export async function deleteSession(store: IStoreAdapter, id: string): Promise<void> {
	await store.query(`DELETE FROM fonderie_admin_sessions WHERE id_hash = $1`, [sha256(id)]);
}

export async function deleteOperatorSessions(
	store: IStoreAdapter,
	operatorId: string,
): Promise<void> {
	await store.query(`DELETE FROM fonderie_admin_sessions WHERE operator_id = $1`, [operatorId]);
}

/** The session behind a cookie value, if it is still alive (absolute and idle). */
export async function readSession(
	store: IStoreAdapter,
	id: string,
): Promise<{ session: ISessionRow; op: IOperatorRow } | null> {
	if (!id) return null;
	const [session] = await store.query<ISessionRow>(
		`SELECT ${SESSION_COLS} FROM fonderie_admin_sessions WHERE id_hash = $1 AND expires_at > now()`,
		[sha256(id)],
	);
	if (!session) return null;
	if (session.stage === 'active' && Date.now() - new Date(session.lastSeenAt).getTime() > IDLE_MS) {
		await store.query(`DELETE FROM fonderie_admin_sessions WHERE id_hash = $1`, [session.idHash]);
		return null;
	}
	const op = await findOperator(store, { id: session.operatorId });
	if (!op || op.disabledAt) return null;
	// Touch at most once a minute: idle tracking without a write per request.
	if (Date.now() - new Date(session.lastSeenAt).getTime() > 60_000) {
		void store
			.query(`UPDATE fonderie_admin_sessions SET last_seen_at = now() WHERE id_hash = $1`, [
				session.idHash,
			])
			.catch(() => undefined);
	}
	return { session, op };
}

export const stepUpFresh = (s: ISessionRow): boolean =>
	s.stepUpAt !== null && Date.now() - new Date(s.stepUpAt).getTime() < STEP_UP_MS;

export async function markStepUp(store: IStoreAdapter, idHash: string): Promise<void> {
	await store.query(`UPDATE fonderie_admin_sessions SET step_up_at = now() WHERE id_hash = $1`, [
		idHash,
	]);
}
