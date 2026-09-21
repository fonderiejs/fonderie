import type {
	BillingAdminClient,
	IAdminCatalog,
	IAdminPlanInput,
	IPlanDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminCatalogReturn {
	catalog: IAdminCatalog | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	createPlan: (input: IAdminPlanInput & { name: string }) => Promise<IPlanDTO>;
	updatePlan: (planId: string, input: IAdminPlanInput) => Promise<IPlanDTO>;
	deletePlan: (planId: string) => Promise<void>;
}

// What am I selling — as configured and as stored — with the stored side editable.
export function useAdminCatalog(client: BillingAdminClient): IUseAdminCatalogReturn {
	const [catalog, setCatalog] = useState<IAdminCatalog | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);


	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.catalog();
			setCatalog(result);
		} catch (err) {
			setError(toError(err));
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const write = useCallback(
		async <T>(fn: () => Promise<{ result: T }>): Promise<T> => {
			setError(null);
			try {
				const { result } = await fn();
				await refresh();
				return result;
			} catch (err) {
				const e = toError(err);
				setError(e);
				throw e;
			}
		},
		[refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		catalog,
		isLoading,
		error,
		refresh,
		createPlan: (input) => write(() => client.createPlan(input)),
		updatePlan: (planId, input) => write(() => client.updatePlan(planId, input)),
		deletePlan: async (planId) => {
			await write(() => client.deletePlan(planId));
		},
	};
}
