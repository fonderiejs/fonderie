import type { AuthClient, IChangePasswordInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseChangePasswordReturn {
	changePassword: (input: IChangePasswordInput) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
	done: boolean;
}

export function useChangePassword(client?: AuthClient): IUseChangePasswordReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useChangePassword');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [done, setDone] = useState(false);

	const changePassword = useCallback(
		async (input: IChangePasswordInput) => {
			setIsLoading(true);
			setError(null);
			setDone(false);
			try {
				await auth.changePassword(input);
				setDone(true);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[auth],
	);

	return { changePassword, isLoading, error, done };
}
