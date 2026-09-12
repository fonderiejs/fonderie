import type { IEventMeta, IEventHandler } from '../types';

export interface IEventTransport {
	publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>;
	subscribe(type: string, handler: IEventHandler, consumer: string): void;
	start(): Promise<void>;
	/** Process everything pending, then return. Durable transports only. */
	drain?(options?: { maxMs?: number }): Promise<void>;
	stop(): Promise<void>;
}
