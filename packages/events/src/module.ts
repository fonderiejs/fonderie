import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core'

import { EventBus }        from './bus'
import { MemoryTransport } from './transports/memory'
import { PGTransport }     from './transports/pg'
import type { IEventTransport } from './transports/types'

export type EventTransportConfig =
	| 'memory'
	| { type: 'pg'; connectionUrl: string; maxRetries?: number; batchSize?: number; pollInterval?: number }
	| IEventTransport

export interface IEventsConfig {
	transport: EventTransportConfig
}

function resolveTransport(config: EventTransportConfig): IEventTransport {
	if (config === 'memory') return new MemoryTransport()

	if (typeof config === 'object' && 'type' in config && config.type === 'pg') {
		return new PGTransport({
			connectionUrl: config.connectionUrl,
			...(config.maxRetries   !== undefined ? { maxRetries:   config.maxRetries   } : {}),
			...(config.batchSize    !== undefined ? { batchSize:    config.batchSize    } : {}),
			...(config.pollInterval !== undefined ? { pollInterval: config.pollInterval } : {}),
		})
	}

	return config as IEventTransport
}

export class EventsModule implements IFonderieModule {
	readonly name = '@fonderie-js/events'
	readonly bus:  EventBus

	constructor(config: IEventsConfig) {
		this.bus = new EventBus(resolveTransport(config.transport))
	}

	install(_app: IFonderieApp): void {
		this.bus.start().catch(err =>
			console.error('[events] failed to start transport', err),
		)
	}
}
