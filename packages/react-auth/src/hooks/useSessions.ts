import type { AuthClient, ISessionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSessionsReturn {
	sessions: ISessionDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Revoke one session. Optimistically removes it; refetches on failure.
	terminate: (id: string) => Promise<void>;
	// Revoke every session except the current one.
	terminateOthers: () => Promise<void>;
}

// The caller's live sessions (one flagged `current`) plus the terminate actions.
export function useSessions(client?: AuthClient): IUseSessionsReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useSessions');
	const [sessions, setSessions] = useState<ISessionDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const toApiError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.listSessions({ bust: opts?.force });
				setSessions(result.sessions);
			} catch (err) {
				setError(toApiError(err));
			} finally {
				setIsLoading(false);
			}
		},
		[auth],
	);

	const terminate = useCallback(
		async (id: string) => {
			const prev = sessions;
			setSessions((s) => s.filter((row) => row.id !== id)); // optimistic
			setError(null);
			try {
				await auth.terminateSession(id);
			} catch (err) {
				setSessions(prev); // roll back the optimistic removal
				setError(toApiError(err));
				throw toApiError(err);
			}
		},
		[auth, sessions],
	);

	const terminateOthers = useCallback(async () => {
		setError(null);
		try {
			await auth.terminateOtherSessions();
			// The server is the source of truth for which survived — refetch (force)
			// rather than trust a local "keep current" guess.
			await refresh({ force: true });
		} catch (err) {
			setError(toApiError(err));
			throw toApiError(err);
		}
	}, [auth, refresh]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { sessions, isLoading, error, refresh, terminate, terminateOthers };
}
