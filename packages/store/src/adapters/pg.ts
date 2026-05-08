import pg from 'pg';
import type { IStoreAdapter, IPoolConfig } from '../types';

export class PGAdapter implements IStoreAdapter {
	private pool: pg.Pool;

	constructor(config: IPoolConfig | string) {
		const options = typeof config === 'string' ? { connectionString: config } : config;
		this.pool = new pg.Pool(options);

		this.pool.on('error', (err) => {
			console.error('[store] idle client error', err.message);
		});
	}

	async testConnection(): Promise<boolean> {
		try {
			await this.pool.query('SELECT 1');
			return true;
		} catch {
			return false;
		}
	}

	async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
		const result = await this.pool.query(sql, params);
		return result.rows as T[]
	}

	async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			const tx: IStoreAdapter = {
				query: async <U = unknown>(sql: string, params?: unknown[]) => {
					const result = await client.query(sql, params);
					return result.rows as U[]
				},
				transaction: <V>(nested: (tx: IStoreAdapter) => Promise<V>) => nested(tx),
			}

			const result = await fn(tx);
			await client.query('COMMIT');
			return result;
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	}

	async end(): Promise<void> {
		await this.pool.end();
	}
}
