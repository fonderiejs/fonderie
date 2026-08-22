import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { clearToken } from '../storage';

export interface IUseLogoutReturn {
	logout: () => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useLogout(client?: AuthClient): IUseLogoutReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useLogout');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const logout = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			await auth.logout();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			auth.setAccessToken(undefined);
			clearToken();
			setIsLoading(false);
		}
	}, [auth]);

	return { logout, isLoading, error };
}
