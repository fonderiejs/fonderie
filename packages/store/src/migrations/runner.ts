import { join }              from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

import type { IStoreAdapter } from '../types';

const MIGRATIONS_TABLE = 'fonderie_migrations';

export class MigrationRunner {
	constructor(
		private store: IStoreAdapter,
		private migrationsDir: string,
	) {}

	async run(): Promise<void> {
		await this.ensureTable();

		const [ applied, files ] = await Promise.all([
			this.getApplied(),
			this.getFiles()
		]);

		const pending = files.filter(f => !applied.has(f));

		if (pending.length === 0) {
			console.log('[store] migrations: up to date');
			return
		}

		for (const file of pending) {
			const sql = await readFile(join(this.migrationsDir, file), 'utf8');

			await this.store.transaction(async tx => {
				await tx.query(sql);
				await tx.query(
					`INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES ($1, now())`,
					[file],
				);
			});

			console.log(`[store] migrations: applied ${file}`);
		}
	}

	private async ensureTable(): Promise<void> {
		await this.store.query(`
			CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
			        name       TEXT PRIMARY KEY,
			        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`);
	}

	private async getApplied(): Promise<Set<string>> {
		const rows = await this.store.query<{ name: string }>(
			`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`
		);
		return new Set(rows.map(r => r.name));
	}

	private async getFiles(): Promise<string[]> {
		const all = await readdir(this.migrationsDir);
		return all.filter(f => f.endsWith('.sql')).sort();  // lexicographic — timestamp prefix keeps order correct
	}
}
