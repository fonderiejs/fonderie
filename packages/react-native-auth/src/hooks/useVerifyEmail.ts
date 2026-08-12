import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseVerifyEmailReturn {
	verifyEmail: (pin: string) => Promise<IVerifyEmailResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: IVerifyEmailResult | null;
}

export function useVerifyEmail(client: AuthClient): IUseVerifyEmailReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<IVerifyEmailResult | null>(null);

	const verifyEmail = useCallback(
		async (pin: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.verifyEmail(pin);
				setData(result);
				return result;
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

	return { verifyEmail, isLoading, error, data };
}
