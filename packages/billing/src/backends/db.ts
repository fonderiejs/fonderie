import type { IStoreAdapter }  from '@fonderie-js/store'
import type { ICounterBackend } from './types'

export class DBCounterBackend implements ICounterBackend {
	constructor(private readonly store: IStoreAdapter) {}

	async increment(key: string, windowMs: number | null, quantity = 1): Promise<number> {
		const [subscriberType, subscriberId, ...rest] = key.split(':')
		const metric = rest.join(':')

		await this.store.query(
			`INSERT INTO fonderie_usage_records (subscriber_type, subscriber_id, metric, quantity)
			 VALUES ($1, $2, $3, $4)`,
			[subscriberType, subscriberId, metric, quantity],
		)

		return this.get(key, windowMs)
	}

	async get(key: string, windowMs: number | null): Promise<number> {
		const [subscriberType, subscriberId, ...rest] = key.split(':')
		const metric = rest.join(':')
		const since  = windowMs !== null ? new Date(Date.now() - windowMs) : new Date(0)

		const rows = await this.store.query<{ total: string }>(
			`SELECT COALESCE(SUM(quantity), 0) AS total
			 FROM fonderie_usage_records
			 WHERE subscriber_type = $1
			   AND subscriber_id   = $2
			   AND metric          = $3
			   AND recorded_at    >= $4`,
			[subscriberType, subscriberId, metric, since],
		)

		return parseInt(rows[0]?.total ?? '0', 10)
	}
}
