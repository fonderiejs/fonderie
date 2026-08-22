import type { AuthClient, ILoginResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseMfaLoginReturn {
	// Completes a login that returned MFA_REQUIRED: verifies the TOTP code
	// against the temporary mfaToken from useLogin's mfaPending, then persists
	// the issued tokens exactly like a normal login.
	verifyLogin: (mfaToken: string, code: string) => Promise<ILoginResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: ILoginResult | null;
}

export function useMfaLogin(client?: AuthClient): IUseMfaLoginReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useMfaLogin');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<ILoginResult | null>(null);

	const verifyLogin = useCallback(
		async (mfaToken: string, code: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.mfa.verifyLogin(mfaToken, code);
				auth.setAccessToken(result.tokens.access);
				persistToken(result.tokens.access);
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

	return { verifyLogin, isLoading, error, data };
}
