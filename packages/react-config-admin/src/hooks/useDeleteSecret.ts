import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseDeleteSecretReturn {
	deleteSecret: (key: string, environment?: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useSecrets().removeSecret` instead — it refreshes the list after deleting. */
export function useDeleteSecret(client: ConfigAdminClient): IUseDeleteSecretReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const deleteSecret = useCallback(
		async (key: string, environment?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.deleteSecret(key, environment);
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

	return { deleteSecret, isLoading, error };
}
