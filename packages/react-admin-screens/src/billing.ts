import type { BillingAdminClient, IAdminSubscriptionDTO } from '@fonderie/client';
import { useEffect, useState } from 'react';
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
export function useSubscriptionIndex(client: BillingAdminClient | undefined) {
	const [index, setIndex] = useState<Map<string, IAdminSubscriptionDTO> | null>(null);
	useEffect(() => {
		if (!client) return;
		let live = true;
		(async () => {
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
			if (live) setIndex(map);
		})().catch(() => {
			if (live) setIndex(new Map());
		});
		return () => {
			live = false;
		};
	}, [client]);
	return index;
}
