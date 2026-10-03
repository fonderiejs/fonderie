import type { FonderieApiError, IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseMembersReturn {
	members: IMemberDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeMember: (userId: string) => Promise<void>;
}

const NONE: IMemberDTO[] = [];

// The selected workspace's members — re-read on a workspace switch.
export function useMembers(client?: WorkspacesClient): IUseMembersReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const q = useScopedQuery(workspaces, '/workspaces/members', async (bust) => (await workspaces.listMembers({ bust })).result.members);
	const w = useWrite(q.refresh);
	const removeMember = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.removeMember(userId);
			}),
		[workspaces, w.run],
	);
	return { members: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, removeMember };
}
