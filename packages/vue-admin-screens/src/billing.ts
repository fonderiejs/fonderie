import type { BillingAdminClient, IAdminSubscriptionDTO } from '@fonderie/client';
import { type Ref, ref } from 'vue';
import type { Tone } from './styles';

/** What the period end means for this subscription. A canceled one does not renew. */
export function periodEnd(s: IAdminSubscriptionDTO): { label: string; date: string } | null {
	if (!s.currentPeriodEnd) return null;
	const date = new Date(s.currentPeriodEnd).toLocaleDateString();
	if (s.status === 'canceled')
		return { label: new Date(s.currentPeriodEnd) < new Date() ? 'Ended' : 'Ends', date };
	if (s.cancelAtPeriodEnd) return { label: 'Ends', date };
	return { label: 'Renews', date };
}

export const statusTone = (status: string): Tone =>
	status === 'active'
		? 'ok'
		: status === 'trialing'
			? 'info'
			: status === 'past_due' || status === 'unpaid'
				? 'warn'
				: 'neutral';

/**
 * Every subscription, keyed by `type/id`, for showing a plan next to each user.
 * Reads the admin list page by page (100 at a time, at most 2,000) — a
 * console-sized index, not a query engine. Anyone absent from it is free.
 */
export function useSubscriptionIndex(
	client: BillingAdminClient | undefined,
): Ref<Map<string, IAdminSubscriptionDTO> | null> {
	const index = ref<Map<string, IAdminSubscriptionDTO> | null>(null) as Ref<Map<
		string,
		IAdminSubscriptionDTO
	> | null>;
	if (!client) return index;
	void (async () => {
		const map = new Map<string, IAdminSubscriptionDTO>();
		let cursor: string | undefined;
		for (let page = 0; page < 20; page++) {
			const { result } = await client.listSubscriptions({
				limit: 100,
				...(cursor ? { cursor } : {}),
			});
			for (const s of result.subscriptions) {
				const key = `${s.subscriberType}/${s.subscriberId}`;
				// Newest first: keep the first (current) one per subscriber.
				if (!map.has(key)) map.set(key, s);
			}
			if (!result.nextCursor) break;
			cursor = result.nextCursor;
		}
		index.value = map;
	})().catch(() => {
		index.value = new Map();
	});
	return index;
}
