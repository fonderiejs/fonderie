import { randomBytes } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie-js/store';

import type { IInvitation } from '../types';

function generateToken(): string {
	return randomBytes(32).toString('hex')
}

function generatePin(): string {
	return Math.floor(100000 + Math.random() * 900000).toString()
}

function parseTtl(ttl: string): number {
	const units: Record<string, number> = {
		s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000,
	}
	const match = ttl.match(/^(\d+)([smhd])$/)
	if (!match) return 7 * 86_400_000
	const [, n, unit] = match
	return parseInt(n!, 10) * (units[unit!] ?? 0)
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
`

export async function createInvitation(
	opts: { workspaceId: string; email: string; roleId: string; ttl?: string },
	store: IStoreAdapter,
): Promise<IInvitation> {
	const token     = generateToken()
	const pin       = generatePin()
	const expiresAt = new Date(Date.now() + parseTtl(opts.ttl ?? '7d'))

	const [invitation] = await store.query<IInvitation>(
		`INSERT INTO fonderie_workspace_invitations
		   (workspace_id, email, role_id, token, pin, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT DO NOTHING
		 RETURNING ${SELECT_INV}`,
		[opts.workspaceId, opts.email, opts.roleId, token, pin, expiresAt],
	)

	if (!invitation) {
		// Already pending — update it
		const [updated] = await store.query<IInvitation>(
			`UPDATE fonderie_workspace_invitations
			 SET token = $4, pin = $5, expires_at = $6, role_id = $3, status = 'PENDING'
			 WHERE workspace_id = $1 AND email = $2 AND status = 'PENDING'
			 RETURNING ${SELECT_INV}`,
			[opts.workspaceId, opts.email, opts.roleId, token, pin, expiresAt],
		)
		if (!updated) throw new Error('Failed to create invitation')
		return updated
	}

	return invitation
}

export async function listInvitations(
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<IInvitation[]> {
	return store.query<IInvitation>(
		`SELECT ${SELECT_INV}
		 FROM fonderie_workspace_invitations
		 WHERE workspace_id = $1 AND status = 'PENDING'
		 ORDER BY created_at DESC`,
		[workspaceId],
	)
}

export async function cancelInvitation(
	invitationId: string,
	workspaceId:  string,
	store:        IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspace_invitations
		 SET status = 'CANCELLED'
		 WHERE id = $1 AND workspace_id = $2 AND status = 'PENDING'`,
		[invitationId, workspaceId],
	)
}

export async function acceptInvitationByPin(
	opts: { pin: string; userId: string },
	store: IStoreAdapter,
): Promise<{ workspaceId: string; roleId: string }> {
	const [inv] = await store.query<{
		id: string; workspaceId: string; roleId: string; expiresAt: string
	}>(
		`SELECT id, workspace_id AS "workspaceId", role_id AS "roleId", expires_at AS "expiresAt"
		 FROM fonderie_workspace_invitations
		 WHERE pin = $1 AND status = 'PENDING'`,
		[opts.pin],
	)

	if (!inv) throw new Error('Invalid PIN')
	if (new Date() > new Date(inv.expiresAt)) throw new Error('Invitation expired')

	await store.transaction(async tx => {
		await Promise.all([
			tx.query(
				`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
				 VALUES ($1, $2, $3, true)
				 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
				 SET confirmed = true, removed = false`,
				[opts.userId, inv.workspaceId, inv.roleId],
			),
			tx.query(
				`UPDATE fonderie_workspace_invitations SET status = 'ACCEPTED' WHERE id = $1`,
				[inv.id],
			),
		])
	})

	return { workspaceId: inv.workspaceId, roleId: inv.roleId }
}

export async function acceptInvitationByToken(
	token:  string,
	userId: string,
	store:  IStoreAdapter,
): Promise<{ workspaceId: string; roleId: string }> {
	const [inv] = await store.query<{
		id: string; workspaceId: string; roleId: string; expiresAt: string
	}>(
		`SELECT id, workspace_id AS "workspaceId", role_id AS "roleId", expires_at AS "expiresAt"
		 FROM fonderie_workspace_invitations
		 WHERE token = $1 AND status = 'PENDING'`,
		[token],
	)

	if (!inv) throw new Error('Invalid token')
	if (new Date() > new Date(inv.expiresAt)) throw new Error('Invitation expired')

	await store.transaction(async tx => {
		await Promise.all([
			tx.query(
				`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
				 VALUES ($1, $2, $3, true)
				 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
				 SET confirmed = true, removed = false`,
				[userId, inv.workspaceId, inv.roleId],
			),
			tx.query(
				`UPDATE fonderie_workspace_invitations SET status = 'ACCEPTED' WHERE id = $1`,
				[inv.id],
			),
		])
	})

	return { workspaceId: inv.workspaceId, roleId: inv.roleId }
}
