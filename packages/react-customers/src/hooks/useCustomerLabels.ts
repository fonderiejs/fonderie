import type { CustomerLabelType, ICustomerLabelDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerLabelsReturn {
	labels: ICustomerLabelDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeLabel: (labelId: string) => Promise<void>;
}

// Shared vocabulary across all customers in the workspace (see
// CustomersClient.listLabels) — not tied to a single customer. New labels
// are created implicitly via addEmail/addPhone/addAddress's `label` string;
// this hook is for browsing/pruning the vocabulary directly.
export function useCustomerLabels(type: CustomerLabelType): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	client: CustomersClient | undefined,
	type: CustomerLabelType,
): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	clientOrType: CustomersClient | CustomerLabelType | undefined,
	maybeType?: CustomerLabelType,
): IUseCustomerLabelsReturn {
	const firstIsClient = clientOrType === undefined || clientOrType instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrType as CustomersClient | undefined) : undefined;
	const type = firstIsClient ? (maybeType as CustomerLabelType) : clientOrType;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerLabels');
	const [labels, setLabels] = useState<ICustomerLabelDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async (opts?: { force?: boolean }) => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await customers.listLabels(type, { bust: opts?.force });
			setLabels(result.labels);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, type]);

	const removeLabel = useCallback(
		async (labelId: string) => {
			setError(null);
			try {
				await customers.removeLabel(labelId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { labels, isLoading, error, refresh, removeLabel };
}
