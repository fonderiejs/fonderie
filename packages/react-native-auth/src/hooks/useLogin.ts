import type { AuthClient, ILoginInput, ILoginResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseLoginReturn {
	login: (input: ILoginInput) => Promise<ILoginResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: ILoginResult | null;
}

export function useLogin(client: AuthClient): IUseLoginReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<ILoginResult | null>(null);

	const login = useCallback(
		async (input: ILoginInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.login(input);
				client.setAccessToken(result.tokens.access);
				await persistToken(result.tokens.access);
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

	return { login, isLoading, error, data };
}
