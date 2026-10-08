import type { FonderieApiError, IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseMembersReturn {
	members: IMemberDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** More rows to load (paged mode only — always false for the whole list). */
	hasMore: boolean;
	/** Append the next page (paged mode only; a no-op otherwise). */
	loadMore: () => Promise<void>;
	isLoadingMore: boolean;
	removeMember: (userId: string) => Promise<void>;
	/** Owner only: make a member a manager. */
	setManager: (userId: string) => Promise<void>;
	/** Owner only: a manager goes back to their other roles. */
	unsetManager: (userId: string) => Promise<void>;
	/** Owner only: someone paused by the velocity brake may delete again. */
	releaseBrake: (userId: string) => Promise<void>;
	/** Owner only, after a step-up (useStepUp): OFFER the workspace to a member — it moves when they accept (useOwnershipOffer); you stay as a manager. */
	transferOwnership: (userId: string) => Promise<void>;
}

const NONE: IMemberDTO[] = [];

export interface IUseListPageOptions {
	/** Read the list `pageSize` rows at a time (loadMore appends). Omit for the whole list, as before. */
	pageSize?: number;
}

// The selected workspace's members — re-read on a workspace switch.
// `opts.pageSize` reads it a page at a time (cursor paging, loadMore appends).
export function useMembers(client?: WorkspacesClient, opts: IUseListPageOptions = {}): IUseMembersReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const limit = opts.pageSize;
	const paged = limit !== undefined;
	// Both reads are always declared (hooks run unconditionally); only one is enabled.
	const whole = useScopedQuery(workspaces, '/workspaces/members', async (bust) => (await workspaces.listMembers({ bust })).result.members, {
		enabled: !paged,
	});
	const pages = usePagedQuery<IMemberDTO, string>(
		workspaces,
		`/workspaces/members?limit=${limit ?? 0}`,
		async (bust) => {
			const { result } = await workspaces.listMembers({ bust, ...(limit !== undefined ? { limit } : {}) });
			return { rows: result.members, next: result.nextCursor ?? null };
		},
		async (cursor) => {
			const { result } = await workspaces.listMembers({ cursor, ...(limit !== undefined ? { limit } : {}) });
			return { rows: result.members, next: result.nextCursor ?? null };
		},
		{ enabled: paged, rethrowLoadMore: false },
	);
	const q = paged
		? { data: pages.rows, isLoading: pages.isLoading, error: pages.error, refresh: pages.refresh }
		: whole;
	const w = useWrite(q.refresh);
	const removeMember = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.removeMember(userId);
			}),
		[workspaces, w.run],
	);
	const setManager = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.setManager(userId);
			}),
		[workspaces, w.run],
	);
	const unsetManager = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.unsetManager(userId);
			}),
		[workspaces, w.run],
	);
	const releaseBrake = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.releaseBrake(userId);
			}),
		[workspaces, w.run],
	);
	const transferOwnership = useCallback(
		(userId: string) =>
			w.run(async () => {
				await workspaces.transferOwnership(userId);
			}),
		[workspaces, w.run],
	);
	return {
		members: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		hasMore: paged && pages.hasMore,
		loadMore: pages.loadMore,
		isLoadingMore: paged && pages.isLoadingMore,
		removeMember,
		setManager,
		unsetManager,
		releaseBrake,
		transferOwnership,
	};
}
