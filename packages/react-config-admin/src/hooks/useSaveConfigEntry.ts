import type { ConfigAdminClient, IConfigEntry, ISetConfigInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseSaveConfigEntryReturn {
	saveConfigEntry: (
		key: string,
		input: ISetConfigInput,
		environment?: string,
	) => Promise<IConfigEntry>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useConfigEntries().saveEntry` instead — it refreshes the list after saving. */
export function useSaveConfigEntry(client: ConfigAdminClient): IUseSaveConfigEntryReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const saveConfigEntry = useCallback(
		async (key: string, input: ISetConfigInput, environment?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.setConfig(key, input, environment);
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

	return { saveConfigEntry, isLoading, error };
}
