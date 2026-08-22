import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseVerifyEmailReturn {
	verifyEmail: (pin: string) => Promise<IVerifyEmailResult>;
	// Re-sends the verification email — the other half of the same lifecycle,
	// so one hook owns both and screens don't split loading/error handling.
	resend: () => Promise<void>;
	resent: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	data: IVerifyEmailResult | null;
}

export function useVerifyEmail(client?: AuthClient): IUseVerifyEmailReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useVerifyEmail');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [data, setData] = useState<IVerifyEmailResult | null>(null);
	const [resent, setResent] = useState(false);

	const resend = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		setResent(false);
		try {
			await auth.sendVerificationEmail();
			setResent(true);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [auth]);

	const verifyEmail = useCallback(
		async (pin: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.verifyEmail(pin);
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

	return { verifyEmail, resend, resent, isLoading, error, data };
}
