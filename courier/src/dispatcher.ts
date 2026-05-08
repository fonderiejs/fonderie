import type { ICourierConfig }                                     from './config';
import type { ICourierMessage, ICourierChannel, ITemplateResolver } from './types';

export class Dispatcher {
	private channels: Map<string, ICourierChannel> = new Map()

	constructor(
		private config:   ICourierConfig,
		private resolver: ITemplateResolver,
	) {}

	registerChannel(channel: ICourierChannel): this {
		this.channels.set(channel.name, channel);
		return this;
	}

	async dispatch(message: ICourierMessage): Promise<void> {
		const channelNames = this.config.channels[message.type];

		if (!channelNames || channelNames.length === 0) {
			console.warn(`[courier] no channels configured for message type: ${message.type}`);
			return
		}

		const template = await this.resolver.resolve(message.type, message.data);

		await Promise.allSettled(
			channelNames.map(async name => {
				const channel = this.channels.get(name);
				if (!channel) {
					console.warn(`[courier] channel "${name}" not registered`);
					return
				}

				try {
					await channel.send(message, template);
				} catch (err) {
					console.error(`[courier:${name}] failed to send ${message.type}:`, err);
				}
			})
		);
	}
}
