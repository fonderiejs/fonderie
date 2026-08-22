import type { CourierAdminClient, ISetTemplateInput, ITemplateEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseTemplatesReturn {
	templates: ITemplateEntry[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	saveTemplate: (
		type: string,
		input: ISetTemplateInput,
		locale?: string | null,
	) => Promise<ITemplateEntry>;
	removeTemplate: (type: string, locale?: string | null) => Promise<void>;
}

export function useTemplates(client: CourierAdminClient): IUseTemplatesReturn {
	const [templates, setTemplates] = useState<ITemplateEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listTemplates();
			setTemplates(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const saveTemplate = useCallback(
		async (type: string, input: ISetTemplateInput, locale?: string | null) => {
			setError(null);
			try {
				const { result } = await client.setTemplate(type, input, locale);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const removeTemplate = useCallback(
		async (type: string, locale?: string | null) => {
			setError(null);
			try {
				await client.deleteTemplate(type, locale);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { templates, isLoading, error, refresh, saveTemplate, removeTemplate };
}
