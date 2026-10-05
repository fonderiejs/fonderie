import { randomBytes, randomInt } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

import type { IInvitation } from '../types';

function generateToken(): string {
	return randomBytes(32).toString('hex');
}

// CSPRNG — Math.random() is predictable and must never mint a credential.
function generatePin(): string {
	return randomInt(100000, 1000000).toString();
}

function parseTtl(ttl: string): number {
	const units: Record<string, number> = {
		s: 1000,
		m: 60_000,
		h: 3_600_000,
		d: 86_400_000,
	};
	const match = ttl.match(/^(\d+)([smhd])$/);
	if (!match) return 7 * 86_400_000;
	const [, n, unit] = match;
	return parseInt(n!, 10) * (units[unit!] ?? 0);
}

const SELECT_INV = `
	id,
	workspace_id AS "workspaceId",
	email,
	role_id      AS "roleId",
	token,
	pin,
	status,
	expires_at   AS "expiresAt",
	created_at   AS "createdAt"
`;

export async function createInvitation(
	opts: { workspaceId: string; email: string; roleId: string; ttl?: string },
	store: IStoreAdapter,
): Promise<IInvitation> {
	const token = generateToken();
	const pin = generatePin();
	const expiresAt = new Date(Date.now() + parseTtl(opts.ttl ?? '7d'));
	// Addresses are stored lower-case: one pending invitation per address
	// (idx_fwi_one_pending), and the PIN lookup compares case-insensitively.
	const email = opts.email.trim().toLowerCase();

	const [invitation] = await store.query<IInvitation>(
		`INSERT INTO fonderie_workspace_invitations
		   (workspace_id, email, role_id, token, pin, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT DO NOTHING
		 RETURNING ${SELECT_INV}`,
		[opts.workspaceId, email, opts.roleId, token, pin, expiresAt],
	);

	if (!invitation) {
		// Already pending for this address — refresh it (new codes, new expiry,
		// the role of the latest invite) instead of stacking a second one.
		const [updated] = await store.query<IInvitation>(
			`UPDATE fonderie_workspace_invitations
			 SET token = $4, pin = $5, expires_at = $6, role_id = $3, status = 'PENDING'
			 WHERE workspace_id = $1 AND lower(email) = $2 AND status = 'PENDING'
			 RETURNING ${SELECT_INV}`,
			[opts.workspaceId, email, opts.roleId, token, pin, expiresAt],
		);
		if (!updated) throw new Error('Failed to create invitation');
		return updated;
	}

	return invitation;
}

export async function listInvitations(
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IInvitation[]> {
	return store.query<IInvitation>(
		`SELECT ${SELECT_INV}
		 FROM fonderie_workspace_invitations
		 WHERE workspace_id = $1 AND status = 'PENDING'
		 ORDER BY created_at DESC`,
		[workspaceId],
	);
}

/**
 * Send a pending invitation again: new token and PIN (the previous ones stop
 * working — the email they were in may be the reason for resending), a fresh
 * expiry. Null when there is no pending invitation with that id here.
 */
export async function resendInvitation(
	invitationId: string,
	workspaceId: string,
	ttl: string,
	store: IStoreAdapter,
): Promise<IInvitation | null> {
	const expiresAt = new Date(Date.now() + parseTtl(ttl));
	const [row] = await store.query<IInvitation>(
		`UPDATE fonderie_workspace_invitations
		 SET token = $3, pin = $4, expires_at = $5
		 WHERE id = $1 AND workspace_id = $2 AND status = 'PENDING'
		 RETURNING ${SELECT_INV}`,
		[invitationId, workspaceId, generateToken(), generatePin(), expiresAt],
	);
	return row ?? null;
}

export async function cancelInvitation(
	invitationId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspace_invitations
		 SET status = 'CANCELLED'
		 WHERE id = $1 AND workspace_id = $2 AND status = 'PENDING'`,
		[invitationId, workspaceId],
	);
}

// Defense-in-depth re-check at ACCEPT time: the stored roleId was validated at
// invite time, but re-confirm here so a role that has since become
// non-assignable (or a hypothetical bad row written directly / by a future
// invite-path bug) can never grant a privileged membership. Assignable =
// exactly what an invitation may target: a workspace-local NON-system role, or
// the seeded least-privilege system GUEST default. A system ADMIN (or any other
// system role) and a foreign workspace's role are refused.
async function assertRoleAssignable(
	roleId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<void> {
	const rows = await store.query<{ id: string }>(
		`SELECT id FROM fonderie_roles
		 WHERE id = $1
		   AND (
		     (workspace_id = $2 AND is_system = false)
		     OR (is_system = true AND name = 'GUEST')
		   )`,
		[roleId, workspaceId],
	);
	if (rows.length === 0) {
		throw new InvitationError('INVITATION_ROLE_UNAVAILABLE', 409, 'The role this invitation gives no longer exists. Ask for a new invitation.');
	}
}

/**
 * Why an invitation cannot be accepted — a reason code a screen can act on
 * (show "ask for a new invite", offer "use another account") instead of
 * parsing an English sentence. The controller answers with `status`.
 */
export class InvitationError extends Error {
	constructor(
		readonly reason:
			| 'INVITATION_NOT_FOUND'
			| 'INVITATION_EXPIRED'
			| 'INVITATION_ALREADY_USED'
			| 'INVITATION_REVOKED'
			| 'INVITATION_EMAIL_MISMATCH'
			| 'INVITATION_ROLE_UNAVAILABLE',
		readonly status: 403 | 404 | 409 | 410,
		message: string,
		readonly details?: Record<string, string>,
	) {
		super(message);
		this.name = 'InvitationError';
	}
}

/** 'ana.lopez@acme.example' → 'a***@acme.example': enough to pick the right account, not to harvest it. */
export function maskEmail(email: string): string {
	const at = email.lastIndexOf('@');
	if (at < 1) return '***';
	return `${email[0]}***${email.slice(at)}`;
}

export type InvitationAccountMatch = 'email-when-present' | 'email' | 'any';

// Single use: the status flip is conditional and runs first, so of two
// concurrent accepts of one invitation (a forwarded link, a double tap) exactly
// one claims it and grants the role; the other is refused.
async function redeem(
	inv: { id: string; workspaceId: string; roleId: string },
	userId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.transaction(async (tx) => {
		const claimed = await tx.query<{ id: string }>(
			`UPDATE fonderie_workspace_invitations SET status = 'ACCEPTED'
			 WHERE id = $1 AND status = 'PENDING'
			 RETURNING id`,
			[inv.id],
		);
		if (claimed.length === 0) throw new InvitationError('INVITATION_ALREADY_USED', 409, 'This invitation has already been used.');
		await tx.query(
			`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
			 VALUES ($1, $2, $3, true)
			 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
			 SET confirmed = true, removed = false`,
			[userId, inv.workspaceId, inv.roleId],
		);
	});
}

export async function acceptInvitationByPin(
	opts: { pin: string; userId: string; email: string },
	store: IStoreAdapter,
): Promise<{ workspaceId: string; roleId: string }> {
	// The PIN is 6 digits, so on its own it is guessable. Binding the lookup to
	// the ACCEPTING user's email means a PIN can only redeem an invitation that
	// was actually addressed to that account — a guessed PIN for someone else's
	// invite matches nothing. (The token path carries 32 bytes of entropy and
	// needs no such binding.)
	const [inv] = await store.query<{
		id: string;
		workspaceId: string;
		roleId: string;
		expiresAt: string;
	}>(
		`SELECT id, workspace_id AS "workspaceId", role_id AS "roleId", expires_at AS "expiresAt"
		 FROM fonderie_workspace_invitations
		 WHERE pin = $1 AND lower(email) = lower($2) AND status = 'PENDING'`,
		[opts.pin, opts.email],
	);

	if (!inv) throw new InvitationError('INVITATION_NOT_FOUND', 404, 'No pending invitation for this account matches that PIN.');
	if (new Date() > new Date(inv.expiresAt)) throw expired();
	await assertRoleAssignable(inv.roleId, inv.workspaceId, store);

	await redeem(inv, opts.userId, store);

	return { workspaceId: inv.workspaceId, roleId: inv.roleId };
}

export async function acceptInvitationByToken(
	token: string,
	userId: string,
	store: IStoreAdapter,
	account: { email?: string | null; match?: InvitationAccountMatch } = {},
): Promise<{ workspaceId: string; roleId: string }> {
	// Looked up whatever its status, so a used or revoked link says so instead
	// of "not found". A resend replaces the token: the old link finds nothing.
	const [inv] = await store.query<{
		id: string;
		workspaceId: string;
		roleId: string;
		expiresAt: string;
		status: string;
		email: string;
	}>(
		`SELECT id, workspace_id AS "workspaceId", role_id AS "roleId", expires_at AS "expiresAt", status, email
		 FROM fonderie_workspace_invitations
		 WHERE token = $1`,
		[token],
	);

	if (!inv) {
		throw new InvitationError('INVITATION_NOT_FOUND', 404, 'This invitation link is no longer valid. A newer one may have been sent — check your email.');
	}
	if (inv.status === 'ACCEPTED') throw new InvitationError('INVITATION_ALREADY_USED', 409, 'This invitation has already been used.');
	if (inv.status !== 'PENDING') throw new InvitationError('INVITATION_REVOKED', 410, 'This invitation was cancelled. Ask for a new one.');
	if (new Date() > new Date(inv.expiresAt)) throw expired();

	const match = account.match ?? 'email-when-present';
	const email = account.email?.trim().toLowerCase() || null;
	if (match !== 'any' && (email ? email !== inv.email.trim().toLowerCase() : match === 'email')) {
		throw new InvitationError(
			'INVITATION_EMAIL_MISMATCH',
			403,
			`This invitation was sent to ${maskEmail(inv.email)}. Sign in with that email address to accept it.`,
			{ email: maskEmail(inv.email) },
		);
	}
	await assertRoleAssignable(inv.roleId, inv.workspaceId, store);

	await redeem(inv, userId, store);

	return { workspaceId: inv.workspaceId, roleId: inv.roleId };
}

function expired(): InvitationError {
	return new InvitationError('INVITATION_EXPIRED', 410, 'This invitation has expired. Ask for a new one.');
}
