import type { IStoreAdapter } from '@fonderie/store';

import type { ICourierConfig } from './config';
import type { ICourierMessage, ICourierChannel, ITemplateResolver } from './types';
import {
	insertMessageLog,
	markMessageSent,
	markMessageFailed,
	setMessageProviderId,
	setMessageResolvedLocale,
} from './log';

function resolveRecipient(message: ICourierMessage, channel: string): string {
	if (channel === 'email') return message.recipient.email ?? '';
	if (channel === 'sms') return message.recipient.phone ?? '';
	if (channel === 'push') return message.recipient.deviceToken ?? '';
	return message.recipient.email ?? message.recipient.phone ?? '';
}

export class Dispatcher {
	private channels: Map<string, ICourierChannel> = new Map();

	constructor(
		private config: ICourierConfig,
		private resolver: ITemplateResolver,
		private store?: IStoreAdapter,
	) {}

	registerChannel(channel: ICourierChannel): this {
		this.channels.set(channel.name, channel);
		return this;
	}

	// Names of the currently-registered channels — used by the boot-time config
	// guard to detect message types routed to a channel with no provider.
	channelNames(): string[] {
		return [...this.channels.keys()];
	}

	/**
	 * The language of the account the recipient's address belongs to — read
	 * from @fonderie/auth's users table when it is in the same database. No
	 * auth, no account, or `recipientLocaleLookup: false`: undefined.
	 */
	private async accountLocale(message: ICourierMessage): Promise<string | undefined> {
		if (!this.store || this.config.recipientLocaleLookup === false) return undefined;
		const { email, phone } = message.recipient;
		if (!email && !phone) return undefined;
		try {
			const [row] = await this.store.query<{ locale: string | null }>(
				`SELECT locale FROM fonderie_users
				 WHERE ($1::text IS NOT NULL AND lower(email) = lower($1))
				    OR ($2::text IS NOT NULL AND phone = $2)
				 ORDER BY (lower(email) = lower($1)) DESC NULLS LAST
				 LIMIT 1`,
				[email ?? null, phone ?? null],
			);
			return row?.locale || undefined;
		} catch {
			return undefined; // no users table here (courier without auth)
		}
	}

	async dispatch(message: ICourierMessage): Promise<void> {
		const channelNames = this.config.channels[message.type];

		if (!channelNames || channelNames.length === 0) {
			console.warn(`[courier] no channels configured for message type: ${message.type}`);
			return;
		}

		// The configured product name is available to EVERY template without each
		// call site remembering to pass it. Spread first so a message that supplies
		// its own brandName still wins (a multi-tenant app may brand per workspace).
		const data = this.config.brandName
			? { brandName: this.config.brandName, ...message.data }
			: message.data;
		// Whose language: the sender's explicit choice, else the recipient's own
		// account, else the sender's fallback (the business's), else the default.
		// Senders without a session (billing webhooks, invitations) used to pass
		// nothing, so a French-speaking customer got their receipt in English.
		const locale = message.locale ?? (await this.accountLocale(message)) ?? message.fallbackLocale;
		const template = await this.resolver.resolve(message.type, data, locale);

		await Promise.allSettled(
			channelNames.map(async (name) => {
				const channel = this.channels.get(name);
				if (!channel) {
					console.warn(`[courier] channel "${name}" not registered`);
					return;
				}

				// Insert log entry (fire-and-forget if store unavailable)
				const logEntry: Parameters<typeof insertMessageLog>[0] = {
					messageType: message.type,
					channel: name,
					recipient: resolveRecipient(message, name),
				};
				if (locale) logEntry.locale = locale;

				const logId = this.store
					? await insertMessageLog(logEntry, this.store).catch(() => '')
					: '';
				if (this.store && logId && template.locale) {
					await setMessageResolvedLocale(logId, template.locale, this.store).catch(() => undefined);
				}

				try {
					const result = await channel.send(message, template);

					if (this.store && logId) {
						// Persist the provider id FIRST — delivery webhooks key on it,
						// and they can arrive within seconds of the send.
						if (result?.providerMessageId) {
							await setMessageProviderId(logId, result.providerMessageId, this.store).catch(
								() => undefined,
							);
						}
						// AWAITED, like the failure write below. Detaching these left
						// the row at 'pending' forever whenever the process stopped
						// before the write landed — which on serverless is routine,
						// since the instance is frozen the moment the handler returns.
						// The send had happened; only the record of it was lost, so
						// the log under-reported successes exactly where it is the
						// only evidence a send occurred. Awaiting costs nothing that
						// matters: this runs in the consumer, not the request path.
						await markMessageSent(logId, this.store).catch(() => undefined);
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					console.error(`[courier:${name}] failed to send ${message.type}:`, err);

					if (this.store && logId) {
						await markMessageFailed(logId, errMsg, this.store).catch(() => undefined);
					}
				}
			}),
		);
	}
}
