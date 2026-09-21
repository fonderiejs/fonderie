import type { AuthAdminClient, ISessionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminUserSessionsReturn {
	sessions: ISessionDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useAdminUserSessions(
	client: AuthAdminClient,
	userId: string | null,
): IUseAdminUserSessionsReturn {
	const [sessions, setSessions] = useState<ISessionDTO[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!userId) {
			setSessions([]);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listUserSessions(userId);
			setSessions(result);
		} catch (err) {
			setError(
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
			);
		} finally {
			setIsLoading(false);
		}
	}, [client, userId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { sessions, isLoading, error, refresh };
}
