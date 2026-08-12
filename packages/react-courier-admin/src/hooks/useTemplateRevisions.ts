import type { CourierAdminClient, ITemplateEntry, ITemplateRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseTemplateRevisionsReturn {
	revisions: ITemplateRevision[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	rollback: (toVersion: number) => Promise<ITemplateEntry>;
}

export function useTemplateRevisions(
	client: CourierAdminClient,
	type: string,
	locale?: string | null,
): IUseTemplateRevisionsReturn {
	const [revisions, setRevisions] = useState<ITemplateRevision[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listRevisions(type, locale);
			setRevisions(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, type, locale]);

	const rollback = useCallback(
		async (toVersion: number) => {
			setError(null);
			try {
				const { result } = await client.rollback(type, { toVersion }, locale);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, type, locale, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { revisions, isLoading, error, refresh, rollback };
}
