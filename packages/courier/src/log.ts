import type { IStoreAdapter } from '@fonderie-js/store';

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
