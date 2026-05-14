import type { IEventTransport } from './types';
import type { IEventMeta, IEventHandler } from '../types';
import { matchesPattern } from './pattern';

export class MemoryTransport implements IEventTransport {
	private subscriptions: Array<{ pattern: string; handler: IEventHandler }> = [];

	async publish(type: string, payload: unknown, meta: IEventMeta): Promise<void> {
		const matching = this.subscriptions.filter((s) => matchesPattern(s.pattern, type));
		await Promise.all(matching.map((s) => s.handler(payload, meta)));
	}

	subscribe(pattern: string, handler: IEventHandler, _consumer: string): void {
		this.subscriptions.push({ pattern, handler });
	}

	async start(): Promise<void> {}
	async stop(): Promise<void> {}
}
