import type { CustomerLabelType, FonderieApiError, ICustomerLabelDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseCustomerLabelsReturn {
	labels: ICustomerLabelDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeLabel: (labelId: string) => Promise<void>;
}

const NONE: ICustomerLabelDTO[] = [];

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
	const q = useScopedQuery(
		customers,
		`/customers/labels?type=${encodeURIComponent(type)}`,
		async (bust) => (await customers.listLabels(type, { bust })).result.labels,
	);
	const w = useWrite(q.refresh);
	const removeLabel = useCallback(
		(labelId: string) =>
			w.run(async () => {
				await customers.removeLabel(labelId);
			}),
		[customers, w.run],
	);
	return { labels: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, removeLabel };
}
