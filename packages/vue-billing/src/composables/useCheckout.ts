import type { BillingClient, ICheckoutInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

// A V4 UUID (with a fallback) — one per checkout attempt, so a retried request
// dedupes to a single session server-side. Mirrors usePurchasePack.
function newIdempotencyKey(): string {
	const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
	return c?.randomUUID ? c.randomUUID() : `co-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface IUseCheckoutReturn {
	checkout: (input: ICheckoutInput) => Promise<string>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useCheckout(client?: BillingClient): IUseCheckoutReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useCheckout');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function checkout(input: ICheckoutInput): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			// Generate a key per attempt; a caller-supplied one still wins.
			const { result } = await billing.createCheckoutSession({
				idempotencyKey: newIdempotencyKey(),
				...input,
			});
			return result.url;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { checkout, isLoading, error };
}
