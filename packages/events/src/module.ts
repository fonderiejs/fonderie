import type { IFonderieModule, IFonderieApp } from '@fonderie/core';

import { EventBus } from './bus';
import { PGTransport } from './transports/pg';
import type { IEventTransport } from './transports/types';

export type EventTransportConfig =
	| {
			type: 'pg';
			connectionUrl: string;
			maxRetries?: number;
			batchSize?: number;
			pollInterval?: number;
	  }
	| IEventTransport;

export interface IEventsConfig {
	transport: EventTransportConfig;
}

function resolveTransport(config: EventTransportConfig): IEventTransport {
	if ('type' in config && config.type === 'pg') {
		return new PGTransport({
			connectionUrl: config.connectionUrl,
			...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
			...(config.batchSize !== undefined ? { batchSize: config.batchSize } : {}),
			...(config.pollInterval !== undefined ? { pollInterval: config.pollInterval } : {}),
		});
	}

	return config as IEventTransport;
}

export class EventsModule implements IFonderieModule {
	readonly name = '@fonderie/events';
	readonly bus: EventBus;

	constructor(config: IEventsConfig) {
		this.bus = new EventBus(resolveTransport(config.transport));
	}

	install(_app: IFonderieApp): void {
		this.bus.start().catch((err) => console.error('[events] failed to start transport', err));
	}
}
