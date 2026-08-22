import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerTagsReturn {
	tags: string[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addTag: (tag: string) => Promise<void>;
	removeTag: (tag: string) => Promise<void>;
}

export function useCustomerTags(customerId: string): IUseCustomerTagsReturn;
export function useCustomerTags(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerTagsReturn;
export function useCustomerTags(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerTagsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerTags');
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
			const { result } = await customers.listTags(customerId);
			setTags(result.tags);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const addTag = useCallback(
		async (tag: string) => {
			setError(null);
			try {
				await customers.addTag(customerId, tag);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const removeTag = useCallback(
		async (tag: string) => {
			setError(null);
			try {
				await customers.removeTag(customerId, tag);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { tags, isLoading, error, refresh, addTag, removeTag };
}
