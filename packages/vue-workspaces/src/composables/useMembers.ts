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
	};
}
