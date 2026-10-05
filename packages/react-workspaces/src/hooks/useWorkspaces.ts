import type {
	FonderieApiError,
	IAcceptInvitationInput,
	ICreateWorkspaceInput,
	IWorkspaceDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseWorkspacesReturn {
	workspaces: IWorkspaceDTO[];
	/** Nothing to show yet — never true while a refresh runs behind data. */
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	/** Join with the link's `{ token }` or the email's PIN (`{ pin }` or a bare string); resolves to the workspace id. */
	acceptInvitation: (code: string | IAcceptInvitationInput) => Promise<string>;
	/**
	 * Leave the SELECTED workspace (the owner must transfer ownership first).
	 * The list refreshes; switch the app to another workspace afterwards.
	 */
	leaveWorkspace: () => Promise<void>;
}

const NONE: IWorkspaceDTO[] = [];

export function useWorkspaces(client?: WorkspacesClient): IUseWorkspacesReturn {
	// Named `resolved` (not `workspaces`) to avoid shadowing the list below.
	const resolved = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	// The signed-in user's own list: the same whichever workspace is selected.
	const q = useScopedQuery(
		resolved,
		'/workspaces',
		async (bust) => (await resolved.listWorkspaces({ bust })).result.workspaces,
		{ perWorkspace: false },
	);
	const w = useWrite(q.refresh);
	const createWorkspace = useCallback(
		(input: ICreateWorkspaceInput) => w.run(async () => (await resolved.createWorkspace(input)).result.workspace),
		[resolved, w.run],
	);
	const acceptInvitation = useCallback(
		(code: string | IAcceptInvitationInput) =>
			w.run(async () => (await resolved.acceptInvitation(code)).result.workspaceId),
		[resolved, w.run],
	);
	const leaveWorkspace = useCallback(
		() =>
			w.run(async () => {
				await resolved.leaveWorkspace();
			}),
		[resolved, w.run],
	);
	return {
		workspaces: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		createWorkspace,
		acceptInvitation,
		leaveWorkspace,
	};
}
