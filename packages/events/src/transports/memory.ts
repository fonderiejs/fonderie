import type { IEventTransport }          from './types'
import type { IEventMeta, IEventHandler } from '../types'

export class MemoryTransport implements IEventTransport {
	private handlers = new Map<string, IEventHandler[]>()

	async publish(type: string, payload: unknown, meta: IEventMeta): Promise<void> {
		const targets = [
			...(this.handlers.get(type) ?? []),
			...(this.handlers.get('*')  ?? []),
		]
		await Promise.all(targets.map(h => h(payload, meta)))
	}

	subscribe(type: string, handler: IEventHandler): void {
		const existing = this.handlers.get(type) ?? []
		this.handlers.set(type, [...existing, handler])
	}

	async start(): Promise<void> {}
	async stop():  Promise<void> {}
}
