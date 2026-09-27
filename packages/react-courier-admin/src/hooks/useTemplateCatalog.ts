import type { CourierAdminClient, ITemplateCatalog } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseTemplateCatalogReturn {
	catalog: ITemplateCatalog | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

// Every email — saved or built-in only — with its languages and the app's
// locales, for a template list that shows what actually exists.
export function useTemplateCatalog(client: CourierAdminClient): IUseTemplateCatalogReturn {
	const [catalog, setCatalog] = useState<ITemplateCatalog | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getTemplateCatalog();
			setCatalog(result);
		} catch (err) {
			setError(
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
			);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { catalog, isLoading, error, refresh };
}
