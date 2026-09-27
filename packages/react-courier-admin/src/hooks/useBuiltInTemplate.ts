import type { CourierAdminClient, IBuiltInTemplate } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseBuiltInTemplateReturn {
	/** Null while loading, and when none ships in that language (404 is not an error here). */
	builtIn: IBuiltInTemplate | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

// Fonderie's own copy of an email in a language — to open a language nobody has
// saved yet, or to compare a saved version with what ships.
export function useBuiltInTemplate(
	client: CourierAdminClient,
	type: string,
	locale?: string | null,
): IUseBuiltInTemplateReturn {
	const [builtIn, setBuiltIn] = useState<IBuiltInTemplate | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getBuiltInTemplate(type, locale);
			setBuiltIn(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			// Nothing ships in that language: an answer, not a failure.
			if (apiError.status === 404) setBuiltIn(null);
			else setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, type, locale]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { builtIn, isLoading, error, refresh };
}
