import type { CourierAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseDeleteTemplateReturn {
	deleteTemplate: (type: string, locale?: string | null) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useDeleteTemplate(client: CourierAdminClient): IUseDeleteTemplateReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const deleteTemplate = useCallback(
		async (type: string, locale?: string | null) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.deleteTemplate(type, locale);
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

	return { deleteTemplate, isLoading, error };
}
