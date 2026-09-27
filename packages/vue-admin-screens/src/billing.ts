import {
	type AdminLocale,
	type AdminT,
	type BillingAdminClient,
	type IAdminSubscriptionDTO,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { type Ref, ref } from 'vue';
import type { Tone } from './styles';

/** What the period end means for this subscription. A canceled one does not renew. */
export function periodEnd(
	s: IAdminSubscriptionDTO,
	locale?: AdminLocale,
): { label: string; date: string } | null {
	if (!s.currentPeriodEnd) return null;
	const t = createAdminT(locale);
	const date = formatAdminDate(s.currentPeriodEnd, locale, 'date');
	if (s.status === 'canceled')
		return {
			label: new Date(s.currentPeriodEnd) < new Date() ? t('billing.ended') : t('billing.ends'),
			date,
		};
	if (s.cancelAtPeriodEnd) return { label: t('billing.ends'), date };
	return { label: t('billing.renews'), date };
}

const STATUS_KEYS = [
	'active',
	'trialing',
	'past_due',
	'unpaid',
	'canceled',
	'incomplete',
	'incomplete_expired',
	'paused',
] as const;

/** A subscription status in the console's language; an unknown one is shown as sent. */
export function statusLabel(t: AdminT, status: string): string {
	return (STATUS_KEYS as readonly string[]).includes(status)
		? t(`billing.statusLabel.${status as (typeof STATUS_KEYS)[number]}`)
		: status;
}

/** A billing interval in the console's language; an unknown one is shown as sent. */
export function intervalLabel(t: AdminT, interval: string): string {
	return interval === 'month' || interval === 'year'
		? t(`billing.intervalLabel.${interval}`)
		: interval;
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
