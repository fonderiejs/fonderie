import type { BillingClient, ISubscriptionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

export interface IUseSubscriptionReturn {
	subscription: ISubscriptionDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

export function useSubscription(client?: BillingClient): IUseSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSubscription');
	const [subscription, setSubscription] = useState<ISubscriptionDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setSubscription(null);
		setError(null);
		setIsLoading(true);
	});
	const beginRequest = useLatestRequest();

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			const isLatest = beginRequest();
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getSubscription({ bust: opts?.force });
				if (!isLatest()) return;
				setSubscription(result.subscription);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				// No active subscription is a normal, expected state — not an error banner.
				if (apiError.status !== 404) setError(apiError);
				setSubscription(null);
			} finally {
				if (isLatest()) setIsLoading(false);
			}
		},
		[billing, beginRequest],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: workspaceId re-runs the read on a workspace switch
	useEffect(() => {
		void refresh();
	}, [refresh, workspaceId]);

	return { subscription, isLoading, error, refresh };
}
