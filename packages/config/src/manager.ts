import type { IStoreAdapter } from '@fonderie/store';

import type { IRemoteConfigOptions } from './config';
import type { IConfigSnapshot } from './types';

const FONDERIE_CONFIG_KEY = 'fonderie.config.snapshot';

export class RemoteConfigManager {
	private snapshot: IConfigSnapshot | null = null;
	private interval: ReturnType<typeof setInterval> | null = null;
	private environment: string;
	private ttl: number;
	private table: string;

	constructor(
		private store: IStoreAdapter,
		options: IRemoteConfigOptions = {},
	) {
		this.ttl = options.ttl ?? 30_000;
		this.environment = options.environment ?? process.env['NODE_ENV'] ?? 'development';
		this.table = options.table ?? 'fonderie_config';
	}

	async boot(): Promise<void> {
		await this.refresh();
		this.interval = setInterval(() => {
			this.refresh().catch((err) => console.error('[config] refresh error:', err));
		}, this.ttl);
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	// Get a single value with a typed fallback
	get<T>(key: string, fallback: T): T {
		if (!this.snapshot) {
			return fallback;
		}

		const value = this.snapshot.entries[key];
		return value !== undefined ? (value as T) : fallback;
	}

	// Get all entries as a flat record
	all(): Record<string, unknown> {
		return this.snapshot?.entries ?? {};
	}

	async refresh(): Promise<void> {
		try {
			const rows = await this.store.query<{
				key: string;
				value: string;
				environment: string;
			}>(
				`SELECT key, value, environment
				 FROM ${this.table}
				 WHERE (environment = $1 OR environment = 'all')
					AND active = true`,
				[this.environment],
			);

			const entries: Record<string, unknown> = {};

			// First pass — load 'all' entries as base
			for (const row of rows) {
				if (row.environment === 'all') {
					try {
						entries[row.key] = JSON.parse(row.value);
					} catch {
						entries[row.key] = row.value;
					}
				}
			}

			// Second pass — environment-specific entries override 'all'
			for (const row of rows) {
				if (row.environment !== 'all') {
					try {
						entries[row.key] = JSON.parse(row.value);
					} catch {
						entries[row.key] = row.value;
					}
				}
			}

			this.snapshot = {
				entries,
				fetchedAt: new Date(),
			};
		} catch (err) {
			console.error('[config] failed to refresh:', err);
		}
	}

	isStale(): boolean {
		if (!this.snapshot) {
			return true;
		}

		return Date.now() - this.snapshot.fetchedAt.getTime() > this.ttl;
	}
}

// Well-known config keys — extend as needed
export const CONFIG_MANAGER_KEY = FONDERIE_CONFIG_KEY;
