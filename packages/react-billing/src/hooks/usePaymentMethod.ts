import type { BillingClient, IPaymentMethodDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

export interface IUsePaymentMethodReturn {
	// The card on file (brand/last4/expiry), or null when none is stored or the
	// provider can't retrieve one (a normal "no card" state, not an error).
	paymentMethod: IPaymentMethodDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's card on file, for a billing page. Reads GET
// /billing/payment-method.
export function usePaymentMethod(client?: BillingClient): IUsePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePaymentMethod');
	const [paymentMethod, setPaymentMethod] = useState<IPaymentMethodDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setPaymentMethod(null);
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
				const { result } = await billing.getPaymentMethod({ bust: opts?.force });
				if (!isLatest()) return;
				setPaymentMethod(result.paymentMethod);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				// 501 = the provider can't retrieve a card — a normal "no card on
				// file" state for a UI, not an error banner.
				if (apiError.status !== 501) setError(apiError);
				setPaymentMethod(null);
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

	return { paymentMethod, isLoading, error, refresh };
}
