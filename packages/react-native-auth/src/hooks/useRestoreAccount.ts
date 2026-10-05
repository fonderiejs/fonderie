import type { AuthClient, ILoginResult, IRestoreAccountInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseRestoreAccountReturn {
	// "Keep my account": the restoreToken from a sign-in that answered
	// ACCOUNT_PENDING_DELETION (read it with pendingDeletionOf(err)), plus
	// mfaCode when the account has two-factor on. Signs in like login.
	restore: (input: IRestoreAccountInput) => Promise<ILoginResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useRestoreAccount(client?: AuthClient): IUseRestoreAccountReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useRestoreAccount');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const restore = useCallback(
		async (input: IRestoreAccountInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.restoreAccount(input);
				auth.setAccessToken(result.tokens.access);
				await persistToken(result.tokens.access);
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

	return { restore, isLoading, error };
}
