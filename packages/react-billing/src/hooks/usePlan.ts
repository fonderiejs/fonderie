import type { BillingClient, IPlanDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUsePlanReturn {
	plan: IPlanDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function usePlan(client: BillingClient, planId: string): IUsePlanReturn {
	const [plan, setPlan] = useState<IPlanDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getPlan(planId);
			setPlan(result.plan);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, planId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { plan, isLoading, error, refresh };
}
