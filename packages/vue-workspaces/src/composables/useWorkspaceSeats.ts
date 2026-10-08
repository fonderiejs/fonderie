import type { FonderieApiError, IWorkspaceSeatsResult, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

export interface IUseWorkspaceSeatsReturn {
	/** Seats against the plan: used (incl. pending invitations), members, pendingInvites, limit (null = none), available. Null until read. */
	seats: ComputedRef<IWorkspaceSeatsResult | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The selected workspace's seats — "3 of 5 seats used (1 invitation pending)".
// Any member may read it; re-read on a workspace switch.
export function useWorkspaceSeats(client?: WorkspacesClient): IUseWorkspaceSeatsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceSeats');
	const q = useScopedQuery(workspaces, '/workspaces/seats', async (bust) => (await workspaces.getSeats({ bust })).result);
	return {
		seats: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
