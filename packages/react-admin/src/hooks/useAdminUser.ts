import type { AuthAdminClient, IAdminUserDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminUserReturn {
	user: IAdminUserDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	suspend: () => Promise<void>;
	unsuspend: () => Promise<void>;
	// Signs the user out everywhere.
	revokeSessions: () => Promise<void>;
}

// One of `email` or `id`; nothing loads until one is given.
export function useAdminUser(
	client: AuthAdminClient,
	by: { email?: string; id?: string },
): IUseAdminUserReturn {
	const [user, setUser] = useState<IAdminUserDTO | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const { email, id } = by;

	const wrap = useCallback(async (fn: () => Promise<void>) => {
		setIsLoading(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const refresh = useCallback(async () => {
		if (!email && !id) {
			setUser(null);
			return;
		}
		await wrap(async () => {
			const { result } = id ? await client.getUser(id) : await client.findUser(email as string);
			setUser(result);
		});
	}, [client, email, id, wrap]);

	const act = useCallback(
		(fn: (userId: string) => Promise<{ result: IAdminUserDTO | undefined }>) => async () => {
			if (!user) return;
			await wrap(async () => {
				const { result } = await fn(user.id);
				if (result) setUser(result);
			});
		},
		[user, wrap],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		user,
		isLoading,
		error,
		refresh,
		suspend: act((userId) => client.suspendUser(userId)),
		unsuspend: act((userId) => client.unsuspendUser(userId)),
		revokeSessions: act(async (userId) => {
			await client.revokeUserSessions(userId);
			return { result: undefined };
		}),
	};
}
