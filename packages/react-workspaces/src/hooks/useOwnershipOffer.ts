import type { FonderieApiError, IOwnershipOfferDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseOwnershipOfferReturn {
	/** The open offer of the selected workspace, or null. */
	offer: IOwnershipOfferDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** The member it is offered to takes the workspace. */
	accept: () => Promise<void>;
	decline: () => Promise<void>;
	/** Owner only: take the offer back. */
	withdraw: () => Promise<void>;
}

// Handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md,
// Phase 4): useMembers().transferOwnership offers, this answers it.
export function useOwnershipOffer(client?: WorkspacesClient): IUseOwnershipOfferReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useOwnershipOffer');
	const q = useScopedQuery(workspaces, '/workspaces/transfer-ownership', async (bust) => (await workspaces.getOwnershipOffer({ bust })).result.offer);
	const w = useWrite(q.refresh);
	const accept = useCallback(() => w.run(async () => { await workspaces.acceptOwnership(); }), [workspaces, w.run]);
	const decline = useCallback(() => w.run(async () => { await workspaces.declineOwnership(); }), [workspaces, w.run]);
	const withdraw = useCallback(() => w.run(async () => { await workspaces.withdrawOwnershipOffer(); }), [workspaces, w.run]);
	return { offer: q.data ?? null, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, accept, decline, withdraw };
}
