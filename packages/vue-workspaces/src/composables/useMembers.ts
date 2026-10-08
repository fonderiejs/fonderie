import type { FonderieApiError, IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseMembersReturn {
	members: Ref<IMemberDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** More rows to load (paged mode only — always false for the whole list). */
	hasMore: Ref<boolean>;
	/** Append the next page (paged mode only; a no-op otherwise). */
	loadMore: () => Promise<void>;
	isLoadingMore: Ref<boolean>;
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
	const sized = limit !== undefined ? { limit } : {};
	const whole = useScopedQuery(workspaces, '/workspaces/members', async (bust) => (await workspaces.listMembers({ bust })).result.members, {
		enabled: !paged,
	});
	const pages = usePagedQuery<IMemberDTO, string>(
		workspaces,
		`/workspaces/members?limit=${limit ?? 0}`,
		async (bust) => {
			const { result } = await workspaces.listMembers({ bust, ...sized });
			return { rows: result.members, next: result.nextCursor ?? null };
		},
		async (cursor) => {
			const { result } = await workspaces.listMembers({ cursor, ...sized });
			return { rows: result.members, next: result.nextCursor ?? null };
		},
		{ enabled: paged, rethrowLoadMore: false },
	);
	const refresh = paged ? pages.refresh : whole.refresh;
	const w = useWrite(() => refresh());
	return {
		members: computed(() => (paged ? pages.rows.value : (whole.data.value ?? NONE))),
		isLoading: paged ? pages.isLoading : whole.isLoading,
		error: computed(() => w.error.value ?? (paged ? pages.error.value : whole.error.value)),
		refresh,
		hasMore: computed(() => paged && pages.hasMore.value),
		loadMore: pages.loadMore,
		isLoadingMore: pages.isLoadingMore,
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
		releaseBrake: (userId) =>
			w.run(async () => {
				await workspaces.releaseBrake(userId);
			}),
		transferOwnership: (userId) =>
			w.run(async () => {
				await workspaces.transferOwnership(userId);
			}),
	};
}
