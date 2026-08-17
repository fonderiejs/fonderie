import pg from 'pg';
import type { IStoreAdapter, IPoolConfig } from '../types';

// Fail-closed check on the database connection, run at pool construction. In
// production a misconfigured DB is a security problem, not just an availability
// one (plaintext transport, shared default credentials). The only fatal case is
// an explicitly-empty connection string — a blank env var silently falling back
// to pg's localhost defaults is almost never intended in production. The rest
// are loud warnings so we don't break legitimate setups (unix sockets, PG* env
// vars, trusted local networks). Outside production this is a no-op.
export function assertProductionDbConfig(options: IPoolConfig): void {
	if (process.env['NODE_ENV'] !== 'production') return;

	const url = options.connectionString;

	if (url !== undefined && url.trim() === '') {
		throw new Error(
			'[store] connectionString is empty in production — refusing to boot. ' +
				'Set a real DATABASE_URL, or omit it entirely to use PG* environment variables.',
		);
	}

	if (url) {
		if (/[?&]sslmode=disable\b/i.test(url) || /[?&]ssl=false\b/i.test(url)) {
			throw new Error(
				'[store] database TLS is disabled (sslmode=disable) in production — traffic to ' +
					'Postgres would be unencrypted. Use sslmode=require (or stronger), or set ' +
					'NODE_ENV appropriately for non-production.',
			);
		}
		if (/:\/\/postgres:postgres@/i.test(url) || /:\/\/postgres:password@/i.test(url)) {
			console.warn('[store] database is using well-known default credentials in production');
		}
	}
}

export class PGAdapter implements IStoreAdapter {
	private pool: pg.Pool;

	constructor(config: IPoolConfig | string) {
		const options = typeof config === 'string' ? { connectionString: config } : config;
		assertProductionDbConfig(options);
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
		return result.rows as T[];
	}

	async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
		const client = await this.pool.connect();

		try {
			await client.query('BEGIN');

			const tx: IStoreAdapter = {
				query: async <U = unknown>(sql: string, params?: unknown[]) => {
					const result = await client.query(sql, params);
					return result.rows as U[];
				},
				transaction: <V>(nested: (tx: IStoreAdapter) => Promise<V>) => nested(tx),
			};

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
