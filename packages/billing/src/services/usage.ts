import type { IStoreAdapter } from '@fonderie-js/store';
import type { SubscriberType } from '../types';

export async function recordUsage(
	opts: { subscriberType: SubscriberType; subscriberId: string; metric: string; quantity: number },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_usage_records (subscriber_type, subscriber_id, metric, quantity)
		VALUES ($1, $2, $3, $4)`,
		[opts.subscriberType, opts.subscriberId, opts.metric, opts.quantity],
	);
}

export async function getUsage(
	subscriberType: SubscriberType,
	subscriberId: string,
	metric: string,
	since: Date,
	store: IStoreAdapter,
): Promise<number> {
	const rows = await store.query<{ total: string }>(
		`SELECT COALESCE(SUM(quantity), 0) AS total
		FROM fonderie_usage_records
		WHERE subscriber_type = $1
			AND subscriber_id   = $2
			AND metric          = $3
			AND recorded_at    >= $4`,
		[subscriberType, subscriberId, metric, since],
	);
	return parseInt(rows[0]?.total ?? '0', 10);
}
