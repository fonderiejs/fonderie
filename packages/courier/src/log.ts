import type { IStoreAdapter } from '@fonderie-js/store';

export type MessageLogStatus = 'pending' | 'sent' | 'failed'

export interface IMessageLog {
	id:          string
	messageType: string
	channel:     string
	recipient:   string
	locale:      string | null
	status:      MessageLogStatus
	error:       string | null
	attempts:    number
	createdAt:   string
	sentAt:      string | null
}

export async function insertMessageLog(
	entry: {
		messageType: string
		channel:     string
		recipient:   string
		locale?:     string
	},
	store: IStoreAdapter,
): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_message_log (message_type, channel, recipient, locale)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		[entry.messageType, entry.channel, entry.recipient, entry.locale ?? null],
	)
	return row?.id ?? ''
}

export async function markMessageSent(id: string, store: IStoreAdapter): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'sent', sent_at = now(), attempts = attempts + 1
		 WHERE id = $1`,
		[id],
	)
}

export async function markMessageFailed(
	id:    string,
	error: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_message_log
		 SET status = 'failed', error = $2, attempts = attempts + 1
		 WHERE id = $1`,
		[id, error],
	)
}
