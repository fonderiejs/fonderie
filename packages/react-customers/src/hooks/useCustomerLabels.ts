import type { CustomerLabelType, CustomersClient, ICustomerLabelDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerLabelsReturn {
	labels: ICustomerLabelDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	removeLabel: (labelId: string) => Promise<void>;
}

// Shared vocabulary across all customers in the workspace (see
// CustomersClient.listLabels) — not tied to a single customer. New labels
// are created implicitly via addEmail/addPhone/addAddress's `label` string;
// this hook is for browsing/pruning the vocabulary directly.
export function useCustomerLabels(
	client: CustomersClient,
	type: CustomerLabelType,
): IUseCustomerLabelsReturn {
	const [labels, setLabels] = useState<ICustomerLabelDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listLabels(type);
			setLabels(result.labels);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, type]);

	const removeLabel = useCallback(
		async (labelId: string) => {
			setError(null);
			try {
				await client.removeLabel(labelId);
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

	return { labels, isLoading, error, refresh, removeLabel };
}
