import type { CustomersClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerTagsReturn {
	tags: string[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addTag: (tag: string) => Promise<void>;
	removeTag: (tag: string) => Promise<void>;
}

export function useCustomerTags(
	client: CustomersClient,
	customerId: string,
): IUseCustomerTagsReturn {
	const [tags, setTags] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!customerId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listTags(customerId);
			setTags(result.tags);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId]);

	const addTag = useCallback(
		async (tag: string) => {
			setError(null);
			try {
				await client.addTag(customerId, tag);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const removeTag = useCallback(
		async (tag: string) => {
			setError(null);
			try {
				await client.removeTag(customerId, tag);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { tags, isLoading, error, refresh, addTag, removeTag };
}
