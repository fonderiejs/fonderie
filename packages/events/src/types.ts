export interface IEventMeta {
	id: string;
	type: string;
	emittedAt: string;
	attempts: number;
	requestId?: string;
	/**
	 * Set when an account erasure redacted this event's personal fields (and
	 * re-signed it): the row was rewritten on purpose, at this time.
	 */
	erasedAt?: string;
}

// Immutable event record — fonderie_events
export interface IEventRecord {
	id: string;
	type: string;
	payload: Record<string, unknown>;
	meta: IEventMeta;
	createdAt: Date;
}

// Per-consumer delivery state — fonderie_event_consumers
export interface IConsumerRecord {
	eventId: string;
	consumer: string;
	status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead' | 'dismissed';
	attempts: number;
	error: string | null;
	processedAt: Date | null;
}

export type IEventHandler<T = unknown> = (payload: T, meta: IEventMeta) => Promise<void>;
