import type { AuthClient, IGoogleNativeInput, ILoginResult, IMfaRequiredResult } from '@fonderie/client';
import { FonderieApiError, isMfaRequired } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';
import { persistToken } from '../storage';

export interface IUseGoogleSignInReturn {
	// Complete a native Sign in with Google. The app gets the `idToken` from the
	// Google SDK (e.g. @react-native-google-signin/google-signin, configured with
	// the API's web client id as webClientId) and passes it here; on success the
	// session token is stored exactly like a password login.
	// An account with MFA answers `{ mfaToken }` instead (check isMfaRequired)
	// — finish with useMfaLogin, as after a password.
	signIn: (input: IGoogleNativeInput) => Promise<ILoginResult | IMfaRequiredResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: ILoginResult | null;
}

export function useGoogleSignIn(client?: AuthClient): IUseGoogleSignInReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useGoogleSignIn');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<ILoginResult | null>(null);

	const signIn = useCallback(
		async (input: IGoogleNativeInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.googleNative(input);
				if (isMfaRequired(result)) return result; // no session until the second factor
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
