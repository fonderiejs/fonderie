import type { AuthClient, IResetPasswordInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseResetPasswordReturn {
	resetPassword: (input: IResetPasswordInput) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
	done: boolean;
}

export function useResetPassword(client: AuthClient): IUseResetPasswordReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [done, setDone] = useState(false);

	const resetPassword = useCallback(
		async (input: IResetPasswordInput) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.resetPassword(input);
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
		[client],
	);

	return { resetPassword, isLoading, error, done };
}
