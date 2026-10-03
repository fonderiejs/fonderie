import type { BillingClient, IWalletDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

export interface IUseWalletReturn {
	// The balance snapshot. Money fields are digit strings (server bigint →
	// string); null until the first read resolves or after a failed read.
	wallet: IWalletDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's stored-value wallet balance. Reads GET /billing/wallet, so
// it reflects the periodic grant withBilling applies on every authed request.
export function useWallet(client?: BillingClient): IUseWalletReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWallet');
	const [wallet, setWallet] = useState<IWalletDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setWallet(null);
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
				const { result } = await billing.getWallet({ bust: opts?.force });
				if (!isLatest()) return;
				setWallet(result.wallet);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				setWallet(null);
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

	return { wallet, isLoading, error, refresh };
}
