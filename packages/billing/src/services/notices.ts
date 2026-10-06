import type { IStoreAdapter } from '@fonderie/store';

import type { SubscriberType } from '../types';

// The durable "send this threshold notice once" marker (fonderie_billing_notices).
// Every API instance runs withBilling, so the claim has to live where all of
// them see it: the first instance to claim a notice for a period sends it, the
// others find it taken.

export interface INoticeKey {
	subscriberType: SubscriberType;
	subscriberId: string;
	notice: string;
}

/**
 * Claim `notice` for `period`. True exactly once per period across every
 * instance: a fresh row, or a row last claimed for a different period (the
 * counter's window moved on), is taken by one statement; a row already holding
 * this period is left alone and the claim returns false.
 */
export async function claimNotice(
	key: INoticeKey,
	period: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ claimed: number }>(
		`INSERT INTO fonderie_billing_notices (subscriber_type, subscriber_id, notice, period)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (subscriber_type, subscriber_id, notice) DO UPDATE
		   SET period = EXCLUDED.period, sent_at = now()
		 WHERE fonderie_billing_notices.period <> EXCLUDED.period
		 RETURNING 1 AS claimed`,
		[key.subscriberType, key.subscriberId, key.notice, period],
	);
	return rows.length > 0;
}

/** Re-arm a notice (the condition cleared), so the next crossing sends again. */
export async function releaseNotice(key: INoticeKey, store: IStoreAdapter): Promise<void> {
	await store.query(
		`DELETE FROM fonderie_billing_notices
		 WHERE subscriber_type = $1 AND subscriber_id = $2 AND notice = $3`,
		[key.subscriberType, key.subscriberId, key.notice],
	);
}
