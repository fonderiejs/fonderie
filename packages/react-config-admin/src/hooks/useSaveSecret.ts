import type { ConfigAdminClient, ISecretEntry, ISetSecretInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseSaveSecretReturn {
	saveSecret: (key: string, input: ISetSecretInput, environment?: string) => Promise<ISecretEntry>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useSecrets().saveSecret` instead — it refreshes the list after saving. */
export function useSaveSecret(client: ConfigAdminClient): IUseSaveSecretReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const saveSecret = useCallback(
		async (key: string, input: ISetSecretInput, environment?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.setSecret(key, input, environment);
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

	return { saveSecret, isLoading, error };
}
