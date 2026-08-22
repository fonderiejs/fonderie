import type { AuthClient, IResetPasswordInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseResetPasswordReturn {
	resetPassword: (input: IResetPasswordInput) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
	done: boolean;
}

export function useResetPassword(client?: AuthClient): IUseResetPasswordReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useResetPassword');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [done, setDone] = useState(false);

	const resetPassword = useCallback(
		async (input: IResetPasswordInput) => {
			setIsLoading(true);
			setError(null);
			try {
				await auth.resetPassword(input);
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

	return { resetPassword, isLoading, error, done };
}
