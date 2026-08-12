import type { CourierAdminClient, ISetTemplateInput, ITemplateEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseSaveTemplateReturn {
	saveTemplate: (
		type: string,
		input: ISetTemplateInput,
		locale?: string | null,
	) => Promise<ITemplateEntry>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useSaveTemplate(client: CourierAdminClient): IUseSaveTemplateReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const saveTemplate = useCallback(
		async (type: string, input: ISetTemplateInput, locale?: string | null) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.setTemplate(type, input, locale);
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

	return { saveTemplate, isLoading, error };
}
