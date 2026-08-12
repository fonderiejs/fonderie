import type { CourierAdminClient, ITemplateEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseTemplateReturn {
	template: ITemplateEntry | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useTemplate(
	client: CourierAdminClient,
	type: string,
	locale?: string | null,
): IUseTemplateReturn {
	const [template, setTemplate] = useState<ITemplateEntry | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getTemplate(type, locale);
			setTemplate(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, type, locale]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { template, isLoading, error, refresh };
}
