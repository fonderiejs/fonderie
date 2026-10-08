import type { FonderieApiError, IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useScopedQuery, useWrite } from '@fonderie/react';

import type { IUseListPageOptions } from './useMembers';
import { useCallback } from 'react';

export interface IUseInvitationsReturn {
	invitations: IInvitationDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** More rows to load (paged mode only — always false for the whole list). */
	hasMore: boolean;
	/** Append the next page (paged mode only; a no-op otherwise). */
	loadMore: () => Promise<void>;
	isLoadingMore: boolean;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
	/** Send again with a new link and PIN (the old ones stop working) and a fresh expiry. */
	resendInvitation: (inviteId: string) => Promise<void>;
}

const NONE: IInvitationDTO[] = [];

// The selected workspace's pending invitations — re-read on a workspace switch.
// `opts.pageSize` reads it a page at a time (newest first; loadMore appends).
export function useInvitations(client?: WorkspacesClient, opts: IUseListPageOptions = {}): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const limit = opts.pageSize;
	const paged = limit !== undefined;
	// Both reads are always declared (hooks run unconditionally); only one is enabled.
	const whole = useScopedQuery(
		workspaces,
		'/workspaces/invitations',
		async (bust) => (await workspaces.listInvitations({ bust })).result.invitations,
		{ enabled: !paged },
	);
	const pages = usePagedQuery<IInvitationDTO, string>(
		workspaces,
		`/workspaces/invitations?limit=${limit ?? 0}`,
		async (bust) => {
			const { result } = await workspaces.listInvitations({ bust, ...(limit !== undefined ? { limit } : {}) });
			return { rows: result.invitations, next: result.nextCursor ?? null };
		},
		async (cursor) => {
			const { result } = await workspaces.listInvitations({ cursor, ...(limit !== undefined ? { limit } : {}) });
			return { rows: result.invitations, next: result.nextCursor ?? null };
		},
		{ enabled: paged, rethrowLoadMore: false },
	);
	const q = paged
		? { data: pages.rows, isLoading: pages.isLoading, error: pages.error, refresh: pages.refresh }
		: whole;
	const w = useWrite(q.refresh);
	const invite = useCallback(
		(entries: IInviteEntry | IInviteEntry[]) =>
			w.run(async () => {
				await workspaces.invite(entries);
			}),
		[workspaces, w.run],
	);
	const cancelInvitation = useCallback(
		(inviteId: string) =>
			w.run(async () => {
				await workspaces.cancelInvitation(inviteId);
			}),
		[workspaces, w.run],
	);
	const resendInvitation = useCallback(
		(inviteId: string) =>
			w.run(async () => {
				await workspaces.resendInvitation(inviteId);
			}),
		[workspaces, w.run],
	);
	return {
		invitations: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		hasMore: paged && pages.hasMore,
		loadMore: pages.loadMore,
		isLoadingMore: paged && pages.isLoadingMore,
		invite,
		cancelInvitation,
		resendInvitation,
	};
}
