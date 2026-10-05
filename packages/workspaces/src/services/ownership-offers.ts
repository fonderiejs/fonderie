import type { IStoreAdapter } from '@fonderie/store';

import { transferOwnershipIn } from './members';

// Handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md,
// Phase 4). Before, one call from the owner's session moved the workspace at
// once and told no one: a stolen session could give a team away in a second.

/** How long an offer stays open. */
export const OWNERSHIP_OFFER_DAYS = 7;

export interface IOwnershipOffer {
	workspaceId: string;
	fromUserId: string;
	toUserId: string;
	createdAt: Date;
	expiresAt: Date;
}

const COLUMNS = `workspace_id AS "workspaceId", from_user_id AS "fromUserId", to_user_id AS "toUserId",
	created_at AS "createdAt", expires_at AS "expiresAt"`;

export type OfferOutcome = { status: 'offered'; offer: IOwnershipOffer } | { status: 'not-member' } | { status: 'not-owner' };

/** The owner offers the workspace to a member; replaces any open offer. */
export async function offerOwnership(store: IStoreAdapter, workspaceId: string, fromUserId: string, toUserId: string): Promise<OfferOutcome> {
	return store.transaction(async (tx): Promise<OfferOutcome> => {
		const [ws] = await tx.query<{ ownerId: string }>(
			`SELECT owner_id AS "ownerId" FROM fonderie_workspaces WHERE id = $1 FOR UPDATE`,
			[workspaceId],
		);
		if (ws?.ownerId !== fromUserId) return { status: 'not-owner' };
		const [member] = await tx.query<{ one: number }>(
			`SELECT 1 AS one FROM fonderie_role_user_workspaces WHERE user_id = $1 AND workspace_id = $2 AND removed = false LIMIT 1`,
			[toUserId, workspaceId],
		);
		if (!member) return { status: 'not-member' };
		const [offer] = await tx.query<IOwnershipOffer>(
			`INSERT INTO fonderie_workspace_ownership_offers (workspace_id, from_user_id, to_user_id, expires_at)
			 VALUES ($1, $2, $3, now() + make_interval(days => $4))
			 ON CONFLICT (workspace_id) DO UPDATE
			 SET from_user_id = EXCLUDED.from_user_id, to_user_id = EXCLUDED.to_user_id,
			     created_at = now(), expires_at = EXCLUDED.expires_at
			 RETURNING ${COLUMNS}`,
			[workspaceId, fromUserId, toUserId, OWNERSHIP_OFFER_DAYS],
		);
		return { status: 'offered', offer: offer! };
	});
}

/** The open offer of a workspace, if any (an expired one is not). */
export async function getOwnershipOffer(store: IStoreAdapter, workspaceId: string): Promise<IOwnershipOffer | null> {
	const [offer] = await store.query<IOwnershipOffer>(
		`SELECT ${COLUMNS} FROM fonderie_workspace_ownership_offers WHERE workspace_id = $1 AND expires_at > now()`,
		[workspaceId],
	);
	return offer ?? null;
}

export type AcceptOutcome = { status: 'accepted'; fromUserId: string } | { status: 'no-offer' } | { status: 'stale' };

class Stale extends Error {}

/**
 * The member the offer is for takes the workspace: the offer is claimed and the
 * ownership moves in ONE transaction. If the offerer is no longer the owner, or
 * the member is no longer in the team, nothing changes ('stale').
 */
export async function acceptOwnershipOffer(store: IStoreAdapter, workspaceId: string, userId: string, managerRole = 'ADMIN'): Promise<AcceptOutcome> {
	try {
		return await store.transaction(async (tx): Promise<AcceptOutcome> => {
			const [offer] = await tx.query<{ fromUserId: string }>(
				`DELETE FROM fonderie_workspace_ownership_offers
				 WHERE workspace_id = $1 AND to_user_id = $2 AND expires_at > now()
				 RETURNING from_user_id AS "fromUserId"`,
				[workspaceId, userId],
			);
			if (!offer) return { status: 'no-offer' };
			if (!(await transferOwnershipIn(tx, workspaceId, offer.fromUserId, userId, managerRole))) throw new Stale();
			return { status: 'accepted', fromUserId: offer.fromUserId };
		});
	} catch (err) {
		if (err instanceof Stale) return { status: 'stale' };
		throw err;
	}
}

/** Declined by the member, or withdrawn by the owner: the offer goes. */
export async function closeOwnershipOffer(store: IStoreAdapter, workspaceId: string, by: { toUserId?: string; fromUserId?: string }): Promise<boolean> {
	const rows = await store.query(
		`DELETE FROM fonderie_workspace_ownership_offers
		 WHERE workspace_id = $1 AND ($2::uuid IS NULL OR to_user_id = $2) AND ($3::uuid IS NULL OR from_user_id = $3)
		 RETURNING workspace_id`,
		[workspaceId, by.toUserId ?? null, by.fromUserId ?? null],
	);
	return rows.length > 0;
}
