import type { IBroadcaster, ISseMessage } from './types';

/**
 * Fan-out inside one process: publish reaches every subscriber here. Right for
 * a single stream host and for tests; several hosts need PgBroadcaster
 * ('@fonderie/sse/pg'), or each only sees the events it processed itself.
 */
export class InProcessBroadcaster implements IBroadcaster {
	private readonly subscribers = new Set<(message: ISseMessage) => void>();

	publish(message: ISseMessage): void {
		for (const deliver of this.subscribers) {
			try {
				deliver(message);
			} catch (err) {
				console.error('[sse] subscriber failed:', (err as Error)?.message);
			}
		}
	}

	subscribe(onMessage: (message: ISseMessage) => void): () => void {
		this.subscribers.add(onMessage);
		return () => {
			this.subscribers.delete(onMessage);
		};
	}
}
