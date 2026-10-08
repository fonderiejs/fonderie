import type { FonderieApiError, IInvitationDTO, IInviteEntry, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useScopedQuery, useWrite } from '@fonderie/vue';

import type { IUseListPageOptions } from './useMembers';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseInvitationsReturn {
	invitations: Ref<IInvitationDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** More rows to load (paged mode only — always false for the whole list). */
	hasMore: Ref<boolean>;
	/** Append the next page (paged mode only; a no-op otherwise). */
	loadMore: () => Promise<void>;
	isLoadingMore: Ref<boolean>;
	invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
	cancelInvitation: (inviteId: string) => Promise<void>;
	/** Send again with a new link and PIN (the old ones stop working) and a fresh expiry. */
	resendInvitation: (inviteId: string) => Promise<void>;
}

const NONE: IInvitationDTO[] = [];

// The selected workspace's invitations — re-read on a workspace switch.
// `opts.pageSize` reads it a page at a time (newest first; loadMore appends).
export function useInvitations(client?: WorkspacesClient, opts: IUseListPageOptions = {}): IUseInvitationsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useInvitations');
	const limit = opts.pageSize;
	const paged = limit !== undefined;
	const sized = limit !== undefined ? { limit } : {};
	const whole = useScopedQuery(workspaces, '/workspaces/invitations', async (bust) => (await workspaces.listInvitations({ bust })).result.invitations, {
		enabled: !paged,
	});
	const pages = usePagedQuery<IInvitationDTO, string>(
		workspaces,
		`/workspaces/invitations?limit=${limit ?? 0}`,
		async (bust) => {
			const { result } = await workspaces.listInvitations({ bust, ...sized });
			return { rows: result.invitations, next: result.nextCursor ?? null };
		},
		async (cursor) => {
			const { result } = await workspaces.listInvitations({ cursor, ...sized });
			return { rows: result.invitations, next: result.nextCursor ?? null };
		},
		{ enabled: paged, rethrowLoadMore: false },
	);
	const refresh = paged ? pages.refresh : whole.refresh;
	const w = useWrite(() => refresh());
	return {
		invitations: computed(() => (paged ? pages.rows.value : (whole.data.value ?? NONE))),
		isLoading: paged ? pages.isLoading : whole.isLoading,
		error: computed(() => w.error.value ?? (paged ? pages.error.value : whole.error.value)),
		refresh,
		hasMore: computed(() => paged && pages.hasMore.value),
		loadMore: pages.loadMore,
		isLoadingMore: pages.isLoadingMore,
		invite: (entries) =>
			w.run(async () => {
				await workspaces.invite(entries);
			}),
		cancelInvitation: (inviteId) =>
			w.run(async () => {
				await workspaces.cancelInvitation(inviteId);
			}),
		resendInvitation: (inviteId) =>
			w.run(async () => {
				await workspaces.resendInvitation(inviteId);
			}),
	};
}
