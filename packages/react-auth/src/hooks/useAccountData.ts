import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { clearToken } from '../storage';

export interface IUseAccountDataReturn {
	// GET /users/export — the caller's own data as a portable bundle (SAR).
	exportData: () => Promise<unknown>;
	// Deletes the account, then tears the session down like a logout.
	deleteUser: () => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useAccountData(client?: AuthClient): IUseAccountDataReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAccountData');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const run = useCallback(async <T>(op: () => Promise<T>): Promise<T> => {
		setIsLoading(true);
		setError(null);
		try {
			return await op();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, []);

	const exportData = useCallback(
		() =>
			run(async () => {
				const { result } = await auth.exportData();
				return result;
			}),
		[auth, run],
	);

	const deleteUser = useCallback(
		() =>
			run(async () => {
				await auth.deleteUser();
				auth.setAccessToken(undefined);
				clearToken();
			}),
		[auth, run],
	);

	return { exportData, deleteUser, isLoading, error };
}
