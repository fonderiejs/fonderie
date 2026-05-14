export interface IEventMeta {
	id:         string
	type:       string
	emittedAt:  string
	attempts:   number
	requestId?: string
}

// Immutable event record — fonderie_events
export interface IEventRecord {
	id:         string
	type:       string
	payload:    Record<string, unknown>
	meta:       IEventMeta
	created_at: Date
}

// Per-consumer delivery state — fonderie_event_consumers
export interface IConsumerRecord {
	event_id:     string
	consumer:     string
	status:       'pending' | 'processing' | 'processed' | 'failed' | 'dead'
	attempts:     number
	error:        string | null
	processed_at: Date | null
}

export type IEventHandler<T = unknown> = (
	payload: T,
	meta:    IEventMeta,
) => Promise<void>
