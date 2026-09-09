import type { AuthClient, ISessionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseSessionsReturn {
	sessions: Ref<ISessionDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Revoke one session. Optimistically removes it; refetches on failure.
	terminate: (id: string) => Promise<void>;
	// Revoke every session except the current one.
	terminateOthers: () => Promise<void>;
}

function toApiError(err: unknown): FonderieApiError {
	return err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
}

// The caller's live sessions (one flagged `current`) plus the terminate actions.
// Same contract as react-auth's useSessions.
export function useSessions(client?: AuthClient): IUseSessionsReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useSessions');
	const sessions = ref<ISessionDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.listSessions({ bust: opts?.force });
			sessions.value = result.sessions;
		} catch (err) {
			error.value = toApiError(err);
		} finally {
			isLoading.value = false;
		}
	}

	async function terminate(id: string) {
		const prev = sessions.value;
		sessions.value = prev.filter((row) => row.id !== id); // optimistic
		error.value = null;
		try {
			await auth.terminateSession(id);
		} catch (err) {
			sessions.value = prev; // roll back the optimistic removal
			error.value = toApiError(err);
			throw toApiError(err);
		}
	}

	async function terminateOthers() {
		error.value = null;
		try {
			await auth.terminateOtherSessions();
			// The server is the source of truth for which survived — refetch (force)
			// rather than trust a local "keep current" guess.
			await refresh({ force: true });
		} catch (err) {
			error.value = toApiError(err);
			throw toApiError(err);
		}
	}

	onMounted(() => void refresh());

	return { sessions, isLoading, error, refresh, terminate, terminateOthers };
}
