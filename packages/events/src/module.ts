import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core'
import type { IStoreAdapter }                 from '@fonderie-js/store'

import { EventBus }        from './bus'
import { MemoryTransport } from './transports/memory'
import { PGTransport }     from './transports/pg'
import type { IEventTransport } from './transports/types'

export type EventTransportConfig =
	| 'memory'
	| { type: 'pg'; store: IStoreAdapter; connectionUrl: string; maxRetries?: number }
	| IEventTransport

export interface IEventsConfig {
	transport: EventTransportConfig
}

function resolveTransport(config: EventTransportConfig): IEventTransport {
	if (config === 'memory') return new MemoryTransport()

	if (typeof config === 'object' && 'type' in config && config.type === 'pg') {
		return new PGTransport({
			store:         config.store,
			connectionUrl: config.connectionUrl,
			...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
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
