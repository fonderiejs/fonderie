import type { IStoreAdapter } from '@fonderie/store';

import type { ICourierConfig } from './config';
import type { ICourierMessage, ICourierChannel, ITemplateResolver } from './types';
import { insertMessageLog, markMessageSent, markMessageFailed } from './log';

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

	async dispatch(message: ICourierMessage): Promise<void> {
		const channelNames = this.config.channels[message.type];

		if (!channelNames || channelNames.length === 0) {
			console.warn(`[courier] no channels configured for message type: ${message.type}`);
			return;
		}

		const template = await this.resolver.resolve(message.type, message.data, message.locale);

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
				if (message.locale) logEntry.locale = message.locale;

				const logId = this.store
					? await insertMessageLog(logEntry, this.store).catch(() => '')
					: '';

				try {
					await channel.send(message, template);

					if (this.store && logId) {
						markMessageSent(logId, this.store).catch(() => undefined);
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : String(err);
					console.error(`[courier:${name}] failed to send ${message.type}:`, err);

					if (this.store && logId) {
						markMessageFailed(logId, errMsg, this.store).catch(() => undefined);
					}
				}
			}),
		);
	}
}
