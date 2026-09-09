import type { AuthClient, ILoginEventDTO, IGetLoginHistoryInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseLoginHistoryReturn {
	events: Ref<ILoginEventDTO[]>;
	isLoading: Ref<boolean>;
	isLoadingMore: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	hasMore: Ref<boolean>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
}

// The caller's own login attempts, newest first, keyset-paginated. Same contract
// as react-auth's useLoginHistory (and vue-audit's useAuditEvents). Unlike React,
// a composable body runs once, so filters need no memoization — they're captured
// at call time.
export function useLoginHistory(rawFilters?: IGetLoginHistoryInput): IUseLoginHistoryReturn;
export function useLoginHistory(
	client: AuthClient | undefined,
	rawFilters?: IGetLoginHistoryInput,
): IUseLoginHistoryReturn;
export function useLoginHistory(
	clientOrFilters?: AuthClient | IGetLoginHistoryInput,
	maybeFilters?: IGetLoginHistoryInput,
): IUseLoginHistoryReturn {
	// The AuthClient isn't reliably an instanceof across bundle boundaries, so
	// detect the client arg structurally (it has getLoginHistory) rather than
	// by prototype.
	const firstIsClient =
		clientOrFilters === undefined ||
		typeof (clientOrFilters as AuthClient).getLoginHistory === 'function';
	const explicit = firstIsClient ? (clientOrFilters as AuthClient | undefined) : undefined;
	const filters = (firstIsClient ? maybeFilters : (clientOrFilters as IGetLoginHistoryInput)) ?? {};
	const auth = useFonderieSubClient(explicit, (c) => c.auth, 'useLoginHistory');

	const events = ref<ILoginEventDTO[]>([]);
	const isLoading = ref(true);
	const isLoadingMore = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const hasMore = ref(false);
	let cursor: string | null = null;

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.getLoginHistory(filters, { bust: opts?.force });
			events.value = result.events;
			cursor = result.nextCursor;
			hasMore.value = result.nextCursor !== null;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMore() {
		if (!cursor || isLoadingMore.value) return;
		isLoadingMore.value = true;
		error.value = null;
		try {
			const { result } = await auth.getLoginHistory({ ...filters, cursor });
			events.value = [...events.value, ...result.events];
			cursor = result.nextCursor;
			hasMore.value = result.nextCursor !== null;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoadingMore.value = false;
		}
	}

	onMounted(() => void refresh());

	return { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore };
}
