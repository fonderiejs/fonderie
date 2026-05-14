export interface IEventMeta {
	id:          string
	type:        string
	emittedAt:   string
	attempts:    number
	requestId?:  string
}

export interface IEventRecord {
	id:           string
	type:         string
	payload:      Record<string, unknown>
	meta:         IEventMeta
	status:       'pending' | 'processed' | 'failed' | 'dead'
	attempts:     number
	error:        string | null
	created_at:   Date
	processed_at: Date | null
}

export type IEventHandler<T = unknown> = (
	payload: T,
	meta:    IEventMeta,
) => Promise<void>
