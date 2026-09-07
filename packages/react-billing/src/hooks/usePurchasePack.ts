import type { BillingClient, IWalletPurchaseResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

// One idempotency key per purchase attempt (reused across the processing
// retries so the provider dedupes to a single charge). Uses crypto.randomUUID
// where available, with a non-crypto fallback for older runtimes.
function newIdempotencyKey(): string {
	const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
	return c?.randomUUID ? c.randomUUID() : `pk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface IUsePurchasePackReturn {
	// Buy a credit pack by charging the saved card — no redirect. Resolves to the
	// outcome; inspect `status`:
	//   'credited'          → done, refresh the wallet;
	//   'checkout_required' → no saved card, or the card needs 3-D Secure —
	//                         fall back to hosted checkout (useWalletCheckout);
	//   'declined'          → hard decline;
	//   'processing'        → still indeterminate after in-place retries.
	// An indeterminate charge is retried here with the SAME idempotency key, so a
	// retry can never double-charge.
	purchase: (packId: string) => Promise<IWalletPurchaseResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function usePurchasePack(client?: BillingClient): IUsePurchasePackReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePurchasePack');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const purchase = useCallback(
		async (packId: string) => {
			setIsLoading(true);
			setError(null);
			const idempotencyKey = newIdempotencyKey();
			try {
				let result: IWalletPurchaseResult | undefined;
				for (let attempt = 0; attempt < 3; attempt++) {
					({ result } = await billing.purchaseWalletPack({ packId, idempotencyKey }));
					if (result.status !== 'processing') return result;
					await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
				}
				return result as IWalletPurchaseResult;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[billing],
	);

	return { purchase, isLoading, error };
}
