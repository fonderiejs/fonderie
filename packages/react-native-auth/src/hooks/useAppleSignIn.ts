import type { AuthClient, IAppleNativeInput, ILoginResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseAppleSignInReturn {
	// Complete a native Sign in with Apple. The app gets the `identityToken` from
	// the native Apple sheet (e.g. expo-apple-authentication) and passes it here;
	// on success the session token is stored exactly like a password login.
	signIn: (input: IAppleNativeInput) => Promise<ILoginResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: ILoginResult | null;
}

export function useAppleSignIn(client?: AuthClient): IUseAppleSignInReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAppleSignIn');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<ILoginResult | null>(null);

	const signIn = useCallback(
		async (input: IAppleNativeInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.appleNative(input);
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

	return { signIn, isLoading, error, data };
}
