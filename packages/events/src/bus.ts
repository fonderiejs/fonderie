import { randomUUID } from 'node:crypto'

import type { IEventTransport }           from './transports/types'
import type { IEventMeta, IEventHandler } from './types'

export class EventBus {
	constructor(private transport: IEventTransport) {}

	async emit<T = unknown>(
		type:    string,
		payload: T,
		opts?:   { requestId?: string },
	): Promise<void> {
		const meta: IEventMeta = {
			id:        randomUUID(),
			type,
			emittedAt: new Date().toISOString(),
			attempts:  0,
			...(opts?.requestId !== undefined ? { requestId: opts.requestId } : {}),
		}
		await this.transport.publish(type, payload, meta)
	}

	on<T = unknown>(type: string, handler: IEventHandler<T>): void {
		this.transport.subscribe(type, handler as IEventHandler)
	}

	async start(): Promise<void> {
		await this.transport.start()
	}

	async stop(): Promise<void> {
		await this.transport.stop()
	}
}
