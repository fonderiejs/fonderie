import type { FonderieApiError, IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseMembersReturn {
	members: Ref<IMemberDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeMember: (userId: string) => Promise<void>;
	/** Owner only: make a member a manager. */
	setManager: (userId: string) => Promise<void>;
	/** Owner only: a manager goes back to their other roles. */
	unsetManager: (userId: string) => Promise<void>;
	/** Owner only, after a step-up (useStepUp): OFFER the workspace to a member — it moves when they accept (useOwnershipOffer); you stay as a manager. */
	transferOwnership: (userId: string) => Promise<void>;
}

const NONE: IMemberDTO[] = [];

// The selected workspace's members — re-read on a workspace switch.
export function useMembers(client?: WorkspacesClient): IUseMembersReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const q = useScopedQuery(workspaces, '/workspaces/members', async (bust) => (await workspaces.listMembers({ bust })).result.members);
	const w = useWrite(() => q.refresh());
	return {
		members: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		removeMember: (userId) =>
			w.run(async () => {
				await workspaces.removeMember(userId);
			}),
		setManager: (userId) =>
			w.run(async () => {
				await workspaces.setManager(userId);
			}),
		unsetManager: (userId) =>
			w.run(async () => {
				await workspaces.unsetManager(userId);
			}),
		transferOwnership: (userId) =>
			w.run(async () => {
				await workspaces.transferOwnership(userId);
			}),
	};
}
