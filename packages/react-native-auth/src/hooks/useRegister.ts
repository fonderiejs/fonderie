import type { AuthClient, IRegisterInput, IRegisterResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseRegisterReturn {
	register: (input: IRegisterInput) => Promise<IRegisterResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: IRegisterResult | null;
}

export function useRegister(client?: AuthClient): IUseRegisterReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useRegister');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<IRegisterResult | null>(null);

	const register = useCallback(
		async (input: IRegisterInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.register(input);
				auth.setAccessToken(result.tokens.access);
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
		[auth],
	);

	return { register, isLoading, error, data };
}
