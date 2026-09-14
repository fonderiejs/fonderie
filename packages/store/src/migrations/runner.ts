import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

import type { IStoreAdapter } from '../types';

const MIGRATIONS_TABLE = 'fonderie_migrations';
const RESERVED_PREFIX_RE = /\bfonderie_/i;

export class MigrationRunner {
	constructor(
		private store: IStoreAdapter,
		private migrationsDir: string,
	) {}

	async run(): Promise<void> {
		await this.ensureTable();

		const [applied, files] = await Promise.all([this.getApplied(), this.getFiles()]);

		const pending = files.filter((f) => !applied.has(f));

		if (pending.length === 0) {
			console.log('[store] migrations: up to date');
			return;
		}

		for (const file of pending) {
			const sql = await readFile(join(this.migrationsDir, file), 'utf8');

			this.assertNoReservedPrefix(file, sql);

			await this.store.transaction(async (tx) => {
				// Cross-process serialization: several instances booting at once all
				// see the same pending list. The advisory xact-lock makes appliers
				// queue, and the in-lock recheck turns the loser's attempt into a
				// no-op instead of a duplicate DDL failure (or worse, a partial
				// double-application on non-idempotent SQL).
				await tx.query(`SELECT pg_advisory_xact_lock(hashtext('${MIGRATIONS_TABLE}'))`);
				const already = await tx.query<{ name: string }>(
					`SELECT name FROM ${MIGRATIONS_TABLE} WHERE name = $1`,
					[file],
				);
				if (already.length > 0) return;

				await tx.query(sql);
				await tx.query(`INSERT INTO ${MIGRATIONS_TABLE} (name, applied_at) VALUES ($1, now())`, [
					file,
				]);
			});

			console.log(`[store] migrations: applied ${file}`);
		}
	}

	protected assertNoReservedPrefix(file: string, sql: string): void {
		if (RESERVED_PREFIX_RE.test(sql)) {
			throw new Error(
				`[store] migration "${file}" uses the reserved "fonderie_" prefix. ` +
				`Use InternalMigrationRunner for fonderie-owned migrations.`,
			);
		}
	}

	/**
	 * Which migrations this database has NOT applied yet — without applying
	 * anything.
	 *
	 * A deployment routinely goes live ahead of its migrations, because they
	 * run out of band: publishing keeps working, and the gap only surfaces when
	 * some request happens to touch the new column or table. The symptom then
	 * looks nothing like the cause — a queue that will not drain, an OAuth
	 * callback that hangs, a health route that 500s — and each one gets
	 * diagnosed separately.
	 *
	 * Exposing the gap turns that into a number a health route can report
	 * BEFORE anything fails. Read-only and safe to call on the request path.
	 *
	 * A missing migrations table means nothing has ever been applied here, so
	 * every file is pending — that is the answer, not an error.
	 */
	async pending(): Promise<string[]> {
		const files = await this.getFiles();
		let applied: Set<string>;
		try {
			applied = await this.getApplied();
		} catch {
			return files;
		}
		return files.filter((f) => !applied.has(f));
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
			`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`,
		);
		return new Set(rows.map((r) => r.name));
	}

	private async getFiles(): Promise<string[]> {
		const all = await readdir(this.migrationsDir);
		const files = all.filter((f) => f.endsWith('.sql')).sort(); // lexicographic
		assertOrderIsUnambiguous(files, this.migrationsDir);
		return files;
	}
}

/**
 * Refuse to run migrations whose filename order does not match their number.
 *
 * Files are applied in LEXICOGRAPHIC order, so `"1100_..." < "200_..."` — "1"
 * sorts before "2". A migration numbered past the widest existing prefix
 * therefore runs FIRST, before the tables it alters exist.
 *
 * This is invisible on a database that already has the earlier migrations: they
 * are recorded as applied, so only the new one runs and it works. It breaks on
 * a FRESH database, which means CI, a new contributor's first setup, and a
 * restore from backup — the three moments you least want a surprise. That is
 * exactly how it happened: production was fine for hours while CI could not
 * start the API at all.
 *
 * Detection is exact rather than heuristic: compare the lexicographic order
 * against the numeric one. Equal orders are fine no matter how the prefixes are
 * padded, so a consistent scheme is never flagged.
 */
export function assertOrderIsUnambiguous(files: string[], dir: string): void {
	const numbered = files
		.map((file) => ({ file, n: Number(/^(\d+)/.exec(file)?.[1] ?? Number.NaN) }))
		.filter((x) => Number.isFinite(x.n));
	if (numbered.length < 2) return;

	const byNumber = [...numbered].sort((a, b) => a.n - b.n).map((x) => x.file);
	const byName = numbered.map((x) => x.file);
	if (byNumber.every((f, i) => f === byName[i])) return;

	// Name the first file that actually moves — that is the one to rename.
	const culprit = byName.find((f, i) => f !== byNumber[i]) ?? byName[0];
	const width = Math.max(...numbered.map((x) => String(x.n).length));
	throw new Error(
		`[store] migrations in ${dir} would run out of order: "${culprit}" sorts by NAME ` +
			`before files with a smaller number, because they are applied lexicographically ` +
			`("1100_" < "200_"). A fresh database would apply it before the migration that ` +
			`creates what it depends on. Renumber it to keep name order and number order the ` +
			`same — pad every prefix to ${width} digits, or number new files above the ` +
			`existing ones without widening (900 -> 910, not 1000). Refusing to run.`,
	);
}

// For fonderie-internal use only. Skips the reserved-prefix guard.
export class InternalMigrationRunner extends MigrationRunner {
	protected override assertNoReservedPrefix(_file: string, _sql: string): void {}
}
