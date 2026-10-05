import type { FonderieApiError, IOwnershipOfferDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseOwnershipOfferReturn {
	/** The open offer of the selected workspace, or null. */
	offer: Ref<IOwnershipOfferDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** The member it is offered to takes the workspace. */
	accept: () => Promise<void>;
	decline: () => Promise<void>;
	/** Owner only: take the offer back. */
	withdraw: () => Promise<void>;
}

// Handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md, Phase 4).
export function useOwnershipOffer(client?: WorkspacesClient): IUseOwnershipOfferReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useOwnershipOffer');
	const q = useScopedQuery(workspaces, '/workspaces/transfer-ownership', async (bust) => (await workspaces.getOwnershipOffer({ bust })).result.offer);
	const w = useWrite(() => q.refresh());
	return {
		offer: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		accept: () => w.run(async () => { await workspaces.acceptOwnership(); }),
		decline: () => w.run(async () => { await workspaces.declineOwnership(); }),
		withdraw: () => w.run(async () => { await workspaces.withdrawOwnershipOffer(); }),
	};
}
