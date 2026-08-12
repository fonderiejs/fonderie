import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseRevealSecretReturn {
	revealSecret: (key: string, environment?: string) => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

// Deliberately a manual action, never auto-fetched — a secret's plaintext
// value should only ever be requested on an explicit user click.
export function useRevealSecret(client: ConfigAdminClient): IUseRevealSecretReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const revealSecret = useCallback(
		async (key: string, environment?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.revealSecret(key, environment);
				return result.value;
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

	return { revealSecret, isLoading, error };
}
