import type { IStoreAdapter } from '@fonderie/store';

export type MessageLogStatus =
	| 'pending' | 'sent' | 'failed'
	| 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam';

export interface IMessageLog {
	id: string;
	messageType: string;
	channel: string;
	recipient: string;
	locale: string | null;
	status: MessageLogStatus;
	error: string | null;
	attempts: number;
	provider: string | null;
	providerMessageId: string | null;
	openedAt: string | null;
	clickedAt: string | null;
	bouncedAt: string | null;
	bounceReason: string | null;
	createdAt: string;
	sentAt: string | null;
}

export async function insertMessageLog(
	entry: {
		messageType: string;
		channel: string;
		recipient: string;
		locale?: string;
		provider?: string;
		providerMessageId?: string;
	},
	store: IStoreAdapter,
): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_message_log
			(message_type, channel, recipient, locale, provider, provider_message_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		[
			entry.messageType,
			entry.channel,
			entry.recipient,
			entry.locale ?? null,
			entry.provider ?? null,
			entry.providerMessageId ?? null,
		],
	);
	return row?.id ?? '';
}

// Persist the provider's message id AFTER the send (the id is only known once
// the provider responds). Delivery webhooks match on this column — without it
// every delivered/opened/bounced update targets zero rows.
export async function setMessageProviderId(
	id: string,
	providerMessageId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET provider_message_id = $2
		 WHERE id = $1`,
		[id, providerMessageId],
	);
}

export async function markMessageSent(id: string, store: IStoreAdapter): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'sent', sent_at = now(), attempts = attempts + 1
		 WHERE id = $1`,
		[id],
	);
}

export async function markMessageFailed(
	id: string,
	error: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'failed', error = $2, attempts = attempts + 1
		 WHERE id = $1`,
		[id, error],
	);
}

export async function markMessageDelivered(
	providerMessageId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'delivered'
		 WHERE provider_message_id = $1`,
		[providerMessageId],
	);
}

export async function markMessageOpened(
	providerMessageId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'opened', opened_at = now()
		 WHERE provider_message_id = $1 AND opened_at IS NULL`,
		[providerMessageId],
	);
}

export async function markMessageClicked(
	providerMessageId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'clicked', clicked_at = now()
		 WHERE provider_message_id = $1 AND clicked_at IS NULL`,
		[providerMessageId],
	);
}

export async function markMessageBounced(
	providerMessageId: string,
	reason: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'bounced', bounced_at = now(), bounce_reason = $2
		 WHERE provider_message_id = $1`,
		[providerMessageId, reason],
	);
}

export interface IMessageStats {
	/** Successfully handed to the provider in the window. */
	sent: number;
	/** Rejected by the provider in the window. */
	failed: number;
	/**
	 * Logged but never resolved either way. Should be ~0; a growing number
	 * means sends are being started and abandoned.
	 */
	pending: number;
	sentAt: Date | null;
	failedAt: Date | null;
	/** The most recent provider error, which is usually the whole diagnosis. */
	lastError: string | null;
}

/**
 * What actually happened to outbound messages, over the last `hours`.
 *
 * This is the ONLY record of whether a message was sent, and reading it is not
 * optional for anyone who wants to know. A send failure is caught by the
 * dispatcher and deliberately not rethrown — a bad address must not poison the
 * event — so the event bus marks its row `processed` whether the message left
 * or not. An SMTP rejection and a clean send are indistinguishable in the
 * queue, and `deadLetters()` stays empty no matter how badly email is failing.
 *
 * Note `sent` means the provider ACCEPTED it. A provider that accepts and then
 * bounces asynchronously (an unverified sending domain, typically) looks like
 * success here; its dashboard is the source of truth for that.
 */
export async function messageStats(
	store: IStoreAdapter,
	options: { hours?: number } = {},
): Promise<IMessageStats> {
	const rows = await store.query<{
		status: string;
		count: string;
		last: Date | null;
		err: string | null;
	}>(
		`SELECT status, count(*)::text AS count, max(created_at) AS last,
		        (array_agg(error ORDER BY created_at DESC)
		           FILTER (WHERE error IS NOT NULL))[1] AS err
		   FROM fonderie_message_log
		  WHERE created_at > now() - make_interval(hours => $1)
		  GROUP BY status`,
		[options.hours ?? 24],
	);
	const of = (s: string) => rows.find((r) => r.status === s);
	const sent = of('sent');
	const failed = of('failed');
	return {
		sent: Number(sent?.count ?? 0),
		failed: Number(failed?.count ?? 0),
		pending: Number(of('pending')?.count ?? 0),
		sentAt: sent?.last ? new Date(sent.last) : null,
		failedAt: failed?.last ? new Date(failed.last) : null,
		lastError: failed?.err ?? null,
	};
}
