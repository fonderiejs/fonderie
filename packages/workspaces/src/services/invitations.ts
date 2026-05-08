import { randomBytes }        from 'node:crypto';

import type { IStoreAdapter } from '@fonderie-js/store';

import type { IInvitation }   from '../types';

function generatePin(): string {
	// 6-digit numeric PIN
	return Math.floor(100000 + Math.random() * 900000).toString();
}

function parseTtl(ttl: string): number {
	const units: Record<string, number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	}

	const match = ttl.match(/^(\d+)([smhd])$/)
	if (!match) {
		return 7 * 24 * 60 * 60 * 1000;
	}

	const [, n, unit] = match;
	return parseInt(n!) * (units[unit!] ?? 0);
}

export async function createInvitation(
	opts: {
		workspaceId: string
		email:       string
		roleId:      string
		ttl?:        string
	},
	store: IStoreAdapter,
): Promise<IInvitation> {
	const pin       = generatePin();
	const expiresAt = new Date(Date.now() + parseTtl(opts.ttl ?? '7d'));

	const [invitation] = await store.query<IInvitation>(
		`INSERT INTO fonderie_workspace_invitations
			(workspace_id, email, role_id, pin, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (workspace_id, email)
		DO UPDATE SET
			pin        = $4,
			expires_at = $5,
			role_id    = $3
		RETURNING
			id,
			workspace_id AS "workspaceId",
			email,
			role_id      AS "roleId",
			pin,
			expires_at   AS "expiresAt",
			created_at   AS "createdAt"`,
		[opts.workspaceId, opts.email, opts.roleId, pin, expiresAt],
	)

	if (!invitation) {
		throw new Error('Failed to create invitation');
	}

	return invitation;
}

export async function acceptInvitation(
	opts: { email: string; pin: string; userId: string },
	store: IStoreAdapter,
): Promise<{ workspaceId: string; roleId: string }> {
	const [inv] = await store.query<{
		id: string
		workspaceId: string
		roleId: string
		expiresAt: Date
	}>(
		`SELECT
			id,
			workspace_id AS "workspaceId",
			role_id      AS "roleId",
			expires_at   AS "expiresAt"
		FROM fonderie_workspace_invitations
		WHERE email = $1
			AND pin   = $2`,
		[opts.email, opts.pin],
	);

	if (!inv) {
		throw new Error('Invalid PIN or email');
	}
	
	if (new Date() > new Date(inv.expiresAt)) {
		throw new Error('Invitation expired');
	}

	await store.transaction(async tx => {
		await Promis.all([
			tx.query(
				`INSERT INTO fonderie_workspace_members (user_id, workspace_id, role_id)
				VALUES ($1, $2, $3)
				ON CONFLICT DO NOTHING`,
				[opts.userId, inv.workspaceId, inv.roleId],
			),
			tx.query(
				`DELETE FROM fonderie_workspace_invitations WHERE id = $1`,
				[inv.id],
			),
		]);
	});

	return {
		roleId: inv.roleId,
		workspaceId: inv.workspaceId, 
	}
}
