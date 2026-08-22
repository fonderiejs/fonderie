import type { AuthClient, ILoginInput, ILoginResult, IMfaRequiredResult } from '@fonderie/client';
import { FonderieApiError, isMfaRequired } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseLoginReturn {
	login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: ILoginResult | null;
	// Set when the account requires MFA: no tokens were issued — complete the
	// login with client.auth.mfa.verifyLogin(mfaPending.mfaToken, code).
	mfaPending: IMfaRequiredResult | null;
}

export function useLogin(client?: AuthClient): IUseLoginReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useLogin');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<ILoginResult | null>(null);
	const [mfaPending, setMfaPending] = useState<IMfaRequiredResult | null>(null);

	const login = useCallback(
		async (input: ILoginInput) => {
			setIsLoading(true);
			setError(null);
			setMfaPending(null);
			try {
				const { result } = await auth.login(input);
				if (isMfaRequired(result)) {
					setMfaPending(result);
					return result;
				}
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

	return { login, isLoading, error, data, mfaPending };
}
