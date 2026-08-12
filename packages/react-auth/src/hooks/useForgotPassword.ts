import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseForgotPasswordReturn {
	forgotPassword: (email: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
	sent: boolean;
}

export function useForgotPassword(client: AuthClient): IUseForgotPasswordReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [sent, setSent] = useState(false);

	const forgotPassword = useCallback(
		async (email: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.forgotPassword(email);
				setSent(true);
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

	return { forgotPassword, isLoading, error, sent };
}
