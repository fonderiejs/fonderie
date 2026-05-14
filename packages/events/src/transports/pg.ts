import pg from 'pg'

import type { IStoreAdapter }             from '@fonderie-js/store'
import type { IEventTransport }           from './types'
import type { IEventMeta, IEventHandler,
              IEventRecord }              from '../types'

export interface IPGTransportConfig {
	store:         IStoreAdapter
	connectionUrl: string
	maxRetries?:   number
	retryDelay?:   number
}

export class PGTransport implements IEventTransport {
	private client:   pg.Client | null = null
	private handlers  = new Map<string, IEventHandler[]>()
	private maxRetries: number
	private retryDelay: number

	constructor(private config: IPGTransportConfig) {
		this.maxRetries = config.maxRetries ?? 3
		this.retryDelay = config.retryDelay ?? 1_000
	}

	async publish(type: string, payload: unknown, meta: IEventMeta): Promise<void> {
		await this.config.store.query(
			`INSERT INTO fonderie_events (id, type, payload, meta)
			 VALUES ($1, $2, $3, $4)`,
			[meta.id, type, JSON.stringify(payload), JSON.stringify(meta)],
		)
		await this.config.store.query(
			`SELECT pg_notify('fonderie_events', $1)`,
			[meta.id],
		)
	}

	subscribe(type: string, handler: IEventHandler): void {
		const existing = this.handlers.get(type) ?? []
		this.handlers.set(type, [...existing, handler])
	}

	async start(): Promise<void> {
		this.client = new pg.Client(this.config.connectionUrl)
		await this.client.connect()
		await this.client.query('LISTEN fonderie_events')

		this.client.on('notification', (msg) => {
			if (!msg.payload) return
			this.processEvent(msg.payload).catch(err =>
				console.error('[events:pg] notification handler error', err),
			)
		})

		this.client.on('error', (err) => {
			console.error('[events:pg] dedicated client error', err.message)
		})

		await this.replayPending()
	}

	async stop(): Promise<void> {
		await this.client?.end()
		this.client = null
	}

	private async processEvent(eventId: string): Promise<void> {
		const [row] = await this.config.store.query<IEventRecord>(
			`SELECT * FROM fonderie_events WHERE id = $1 AND status = 'pending' LIMIT 1`,
			[eventId],
		)
		if (!row) return

		const handlers = [
			...(this.handlers.get(row.type) ?? []),
			...(this.handlers.get('*')      ?? []),
		]

		if (handlers.length === 0) {
			await this.config.store.query(
				`UPDATE fonderie_events SET status = 'processed', processed_at = now() WHERE id = $1`,
				[eventId],
			)
			return
		}

		try {
			await Promise.all(handlers.map(h => h(row.payload, row.meta)))
			await this.config.store.query(
				`UPDATE fonderie_events SET status = 'processed', processed_at = now() WHERE id = $1`,
				[eventId],
			)
		} catch (err) {
			const attempts = (row.attempts ?? 0) + 1
			const status   = attempts >= this.maxRetries ? 'dead' : 'failed'
			await this.config.store.query(
				`UPDATE fonderie_events
				 SET status = $1, attempts = $2, error = $3
				 WHERE id = $4`,
				[status, attempts, err instanceof Error ? err.message : String(err), eventId],
			)
			if (status === 'failed') {
				await new Promise(r => setTimeout(r, this.retryDelay))
				await this.processEvent(eventId)
			}
		}
	}

	private async replayPending(): Promise<void> {
		const rows = await this.config.store.query<IEventRecord>(
			`SELECT * FROM fonderie_events
			 WHERE status IN ('pending', 'failed')
			 ORDER BY created_at ASC`,
		)
		for (const row of rows) {
			await this.processEvent(row.id)
		}
	}
}
