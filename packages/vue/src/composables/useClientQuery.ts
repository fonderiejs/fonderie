import { queryStoreFor } from '@fonderie/client';
import type { IQueryEntry } from '@fonderie/client';
import { computed, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, shallowRef, watch } from 'vue';
import type { ComputedRef } from 'vue';

// The one way a Fonderie composable reads server data — the Vue twin of
// @fonderie/react's useClientQuery, over the same client store (see
// @fonderie/client's query-store.ts for the rules): what was fetched shows at
// once; a read fetches only when the answer is missing or stale; a refresh
// happens behind the data; an unchanged answer changes nothing.

export interface IUseClientQueryOptions {
	/** Override the client's staleness window for this read (ms). */
	staleMs?: number;
}

export interface IClientQueryResult<T> {
	/** The last good answer — kept through refreshes and failures. */
	data: ComputedRef<T | undefined>;
	/** The last fetch's failure (null once one succeeds). */
	error: ComputedRef<unknown>;
	/** Nothing to show yet: no answer and none failed (or a retry is running). */
	isLoading: ComputedRef<boolean>;
	/** A request is in flight — a refresh behind data shown. */
	isFetching: ComputedRef<boolean>;
	/** Fetch now, whatever the staleness; `force` is handed to the fetcher (HTTP cache `bust`). */
	refresh: (opts?: { force?: boolean }) => Promise<T | undefined>;
}

const EMPTY: IQueryEntry = Object.freeze({ data: undefined, error: null, updatedAt: 0, isFetching: false });

/**
 * @param source  the FonderieClient or sub-client the composable reads through
 * @param key     a getter for the query key (include path, workspace, params);
 *                returning null = nothing to read. Re-read when it changes.
 * @param fetcher performs the request; `force` is true for an explicit refresh
 */
export function useClientQuery<T>(
	source: object,
	key: () => string | null,
	fetcher: (ctx: { force: boolean }) => Promise<T>,
	opts: IUseClientQueryOptions = {},
): IClientQueryResult<T> {
	const store = queryStoreFor(source);
	const entry = shallowRef<IQueryEntry<T>>(EMPTY as IQueryEntry<T>);
	let current: string | null = null;
	let off = () => {};
	// Inside a component, the network waits for mount — never during SSR, where
	// onMounted does not run (what was already fetched still shows at once).
	// Outside one (a plain effect scope), there is no mount to wait for.
	const instance = getCurrentInstance();
	let mounted = !instance;
	if (instance) {
		onMounted(() => {
			mounted = true;
			if (current) void load(current, false);
		});
	}

	const load = (k: string, force: boolean, bust = force) =>
		store.fetch(k, () => fetcher({ force: bust }), {
			force,
			...(opts.staleMs !== undefined ? { staleMs: opts.staleMs } : {}),
		});

	watch(
		key,
		(k) => {
			off();
			off = () => {};
			current = k;
			if (!k) {
				entry.value = EMPTY as IQueryEntry<T>;
				return;
			}
			entry.value = store.peek<T>(k);
			let lastUpdated = entry.value.updatedAt;
			off = store.subscribe(k, () => {
				const next = store.peek<T>(k);
				// A write invalidated it (updatedAt dropped to 0): refetch behind
				// the data. Not when a fetch merely finished — a failed fetch
				// leaves it stale, and retrying on that would loop.
				const invalidated = next.updatedAt === 0 && lastUpdated !== 0;
				lastUpdated = next.updatedAt;
				entry.value = next;
				if (invalidated && mounted) void load(k, false);
			});
			if (mounted) void load(k, false);
		},
		{ immediate: true },
	);
	if (getCurrentScope()) onScopeDispose(() => off());

	return {
		data: computed(() => entry.value.data),
		error: computed(() => entry.value.error),
		isLoading: computed(
			() =>
				current !== null &&
				entry.value.data === undefined &&
				(entry.value.isFetching || entry.value.error == null),
		),
		isFetching: computed(() => entry.value.isFetching),
		refresh: async (o?: { force?: boolean }) => (current ? load(current, true, o?.force === true) : undefined),
	};
}
