import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { sql } from '../sql';

// ── sql`` helper ─────────────────────────────────────────────────

test('sql: single value produces correct placeholder', () => {
	const q = sql`SELECT * FROM users WHERE id = ${'abc'}`;
	assert.equal(q.text, 'SELECT * FROM users WHERE id = $1');
	assert.deepEqual(q.params, ['abc']);
});

test('sql: multiple values produce sequential placeholders', () => {
	const q = sql`SELECT * FROM users WHERE email = ${'a@b.com'} AND active = ${true}`;
	assert.equal(q.text, 'SELECT * FROM users WHERE email = $1 AND active = $2');
	assert.deepEqual(q.params, ['a@b.com', true]);
});

test('sql: no interpolations returns bare text with empty params', () => {
	const q = sql`SELECT 1`;
	assert.equal(q.text, 'SELECT 1');
	assert.deepEqual(q.params, []);
});

test('sql: null value is passed through as param', () => {
	const q = sql`UPDATE users SET deleted_at = ${null} WHERE id = ${'x'}`;
	assert.equal(q.text, 'UPDATE users SET deleted_at = $1 WHERE id = $2');
	assert.deepEqual(q.params, [null, 'x']);
});

test('sql: numeric zero is a valid param', () => {
	const q = sql`SELECT * FROM items WHERE quantity = ${0}`;
	assert.equal(q.text, 'SELECT * FROM items WHERE quantity = $1');
	assert.deepEqual(q.params, [0]);
});

// ── IStoreAdapter shape ───────────────────────────────────────────
// No real DB in unit tests — verify the adapter satisfies the interface
// by building a minimal in-memory stub and type-checking it.

import type { IStoreAdapter, IPoolConfig } from '../types';
import { createMigrationsPath, MigrationRunner, InternalMigrationRunner } from '../migrations';

test('IStoreAdapter: stub satisfies interface at compile time', () => {
	const rows: unknown[] = [];

	const stub: IStoreAdapter = {
		query: async <T = unknown>(_sql: string, _params?: unknown[]) => rows as T[],
		transaction: async (fn) => fn(stub),
	};

	assert.ok(typeof stub.query === 'function');
	assert.ok(typeof stub.transaction === 'function');
});

// ── IPoolConfig ───────────────────────────────────────────────────

test('IPoolConfig: accepts connection string form', () => {
	const config: IPoolConfig = { connectionString: 'postgres://localhost/test' };
	assert.equal(config.connectionString, 'postgres://localhost/test');
});

test('IPoolConfig: accepts individual field form with tuning knobs', () => {
	const config: IPoolConfig = {
		host: 'localhost',
		port: 5432,
		database: 'test',
		user: 'postgres',
		password: 'secret',
		max: 10,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 5_000,
	};
	assert.equal(config.host, 'localhost');
	assert.equal(config.max, 10);
});

// ── createMigrationsPath ──────────────────────────────────────────

test('createMigrationsPath: returns absolute path ending in migrations/sql', () => {
	// Simulate being called from dist/migrations/index.js as intended
	const fakeUrl = 'file:///some/package/dist/migrations/index.js';
	const result = createMigrationsPath(fakeUrl);
	assert.ok(result.endsWith('migrations/sql') || result.endsWith('migrations\\sql'));
});

// ── MigrationRunner namespace guard ──────────────────────────────

test('MigrationRunner: throws when SQL uses reserved fonderie_ prefix', () => {
	const runner = new MigrationRunner({} as IStoreAdapter, '/fake');
	assert.throws(
		() => (runner as any).assertNoReservedPrefix('001_bad.sql', 'CREATE TABLE fonderie_todos (id TEXT)'),
		/reserved "fonderie_" prefix/,
	);
});

test('MigrationRunner: allows SQL with no fonderie_ prefix', () => {
	const runner = new MigrationRunner({} as IStoreAdapter, '/fake');
	assert.doesNotThrow(() =>
		(runner as any).assertNoReservedPrefix('001_ok.sql', 'CREATE TABLE todos (id TEXT)'),
	);
});

test('InternalMigrationRunner: allows SQL with fonderie_ prefix', () => {
	const runner = new InternalMigrationRunner({} as IStoreAdapter, '/fake');
	assert.doesNotThrow(() =>
		(runner as any).assertNoReservedPrefix('001_internal.sql', 'CREATE TABLE fonderie_users (id TEXT)'),
	);
});

// ── versioned primitive ──────────────────────────────────────────

import { versionedWrite, versionedRollback, VersionConflictError } from '../versioned';

function captureStore(rows: (sql: string) => unknown[]) {
	const seen: string[] = [];
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => { seen.push(sql); return rows(sql) as T[]; },
		transaction: async (fn) => fn(stub),
	};
	return { store: stub, seen };
}

const CFG = { table: 'cfg', revisions: 'cfg_rev', channel: 'cfg_ch', keyColumns: ['key', 'environment'] as const, contentColumns: ['value'] as const, metaColumns: ['description', 'active'] as const, returning: 'key, version' };
const TPL = { table: 'tpl', revisions: 'tpl_rev', channel: 'tpl_ch', keyColumns: ['type', 'locale'] as const, contentColumns: ['subject', 'html', 'text'] as const, metaColumns: ['active'] as const, returning: 'type, version' };

test('versionedWrite: create inserts key + content + version, appends revision, notifies', async () => {
	const { store, seen } = captureStore((sql) => (sql.includes('RETURNING') ? [{ key: 'k', version: 1 }] : []));
	await versionedWrite(CFG, store, { key: 'k', scope: 'all', data: { value: 'v', active: true }, actor: 'ada' });
	assert.ok(seen.some((s) => s.includes('pg_advisory_xact_lock')), 'advisory lock taken');
	assert.ok(seen.some((s) => s.startsWith('INSERT INTO cfg ')), 'main insert');
	assert.ok(seen.some((s) => s.includes('INSERT INTO cfg_rev')), 'revision appended');
	assert.ok(seen.some((s) => s.includes("pg_notify('cfg_ch'")), 'invalidation notified');
});

test('versionedWrite: optimistic concurrency — stale ifVersion throws', async () => {
	const { store } = captureStore((sql) => (sql.includes('SELECT version') ? [{ version: 5 }] : []));
	await assert.rejects(
		() => versionedWrite(CFG, store, { key: 'k', scope: 'all', data: { value: 'v' }, ifVersion: 1, actor: null }),
		(e: unknown) => e instanceof VersionConflictError && (e as VersionConflictError).currentVersion === 5,
	);
});

test('versionedWrite: multi-column content + null scope (courier shape)', async () => {
	const { store, seen } = captureStore((sql) => (sql.includes('RETURNING') ? [{ type: 'x', version: 1 }] : []));
	await versionedWrite(TPL, store, { key: 'email-verification', scope: null, data: { subject: 's', html: 'h', text: 't' }, actor: 'ada' });
	const ins = seen.find((s) => s.startsWith('INSERT INTO tpl '))!;
	assert.match(ins, /\(type, locale, subject, html, text, version, updated_by\)/); // all 3 content cols
	// null-safe key matching used everywhere
	assert.ok(seen.some((s) => s.includes('locale IS NOT DISTINCT FROM')));
});

test('versionedRollback: writes a past revision content as a new version', async () => {
	const { store, seen } = captureStore((sql) => {
		if (sql.includes('FROM tpl_rev')) return [{ subject: 'old', html: 'oldh', text: 'oldt' }];
		if (sql.includes('SELECT version FROM tpl')) return [{ version: 4 }];
		if (sql.includes('RETURNING')) return [{ type: 'x', version: 5 }];
		return [];
	});
	const row = await versionedRollback(TPL, store, { key: 'email-verification', scope: null, toVersion: 1, actor: 'ada' });
	assert.equal((row as { version: number }).version, 5);
	assert.ok(seen.some((s) => s.startsWith('UPDATE tpl SET')));
});

// ── production DB config fail-closed check ───────────────────────
import { assertProductionDbConfig } from '../adapters/pg';

test('assertProductionDbConfig: no-op outside production', () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'development';
	try {
		assert.doesNotThrow(() => assertProductionDbConfig({ connectionString: '' }));
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});

test('assertProductionDbConfig: empty connectionString is fatal in production', () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		assert.throws(() => assertProductionDbConfig({ connectionString: '   ' }), /empty in production/);
		// a real URL and env-var mode (no string) are both fine
		assert.doesNotThrow(() => assertProductionDbConfig({ connectionString: 'postgres://u:p@db:5432/app' }));
		assert.doesNotThrow(() => assertProductionDbConfig({ host: 'db', user: 'u' }));
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});

test('assertProductionDbConfig: THROWS on sslmode=disable in production (A4)', () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		assert.throws(
			() => assertProductionDbConfig({ connectionString: 'postgres://u:p@db/app?sslmode=disable' }),
			/TLS is disabled/,
		);
		// TLS enabled is fine
		assert.doesNotThrow(() => assertProductionDbConfig({ connectionString: 'postgres://u:p@db/app?sslmode=require' }));
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});

// ── Security: migration runner cross-process serialization ──────────
// Several instances booting at once all read the same pending list; without
// an advisory lock + in-lock recheck, both apply the same migration.

test('MigrationRunner: takes the advisory lock and rechecks inside it', async () => {
	const { mkdtemp, writeFile } = await import('node:fs/promises');
	const { tmpdir } = await import('node:os');
	const { join: pjoin } = await import('node:path');
	const dir = await mkdtemp(pjoin(tmpdir(), 'fonderie-mig-'));
	await writeFile(pjoin(dir, '001_init.sql'), 'CREATE TABLE app_things (id INT)');

	const executed: { sql: string; params: unknown[] }[] = [];
	const store = {
		query: async (sql: string, params?: unknown[]) => {
			executed.push({ sql, params: params ?? [] });
			// applied-recheck inside the lock: report ALREADY applied
			if (sql.includes('WHERE name = $1')) return [{ name: '001_init.sql' }];
			return [];
		},
		transaction: async (fn: (tx: unknown) => unknown) => fn(store),
	} as unknown as IStoreAdapter;

	await new MigrationRunner(store, dir).run();

	assert.ok(
		executed.some((q) => q.sql.includes('pg_advisory_xact_lock')),
		'advisory lock taken before applying',
	);
	assert.ok(
		!executed.some((q) => q.sql.includes('CREATE TABLE app_things')),
		'migration NOT re-applied when the in-lock recheck says another process won',
	);
});

// ── Security: production TLS gate covers the config-object form ─────

test('assertProductionDbConfig: throws on ssl:false object config in production', async () => {
	const { assertProductionDbConfig } = await import('../adapters/pg');
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		assert.throws(
			() => assertProductionDbConfig({ host: 'db.internal', ssl: false } as never),
			/TLS is disabled/,
		);
		// Explicitly-enabled ssl passes.
		assert.doesNotThrow(() => assertProductionDbConfig({ host: 'db.internal', ssl: true } as never));
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV'];
		else process.env['NODE_ENV'] = prev;
	}
});

// ── pending migrations ────────────────────────────────────────────
// The gap between "deployed" and "migrated" is invisible until some request
// touches the new column. These make it a number instead.

test('pending(): reports files the database has not applied', async () => {
	const { MigrationRunner } = await import('../migrations/runner');
	const dir = await import('node:fs/promises').then((fs) =>
		fs.mkdtemp(join(tmpdir(), 'fonderie-mig-')),
	);
	const fs = await import('node:fs/promises');
	for (const f of ['001_a.sql', '002_b.sql', '003_c.sql']) {
		await fs.writeFile(join(dir, f), 'SELECT 1;');
	}

	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			if (sql.includes('SELECT name FROM fonderie_migrations')) {
				return [{ name: '001_a.sql' }] as T[]; // only the first was applied
			}
			return [] as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(store),
	};

	const pending = await new MigrationRunner(store as never, dir).pending();
	assert.deepEqual(pending, ['002_b.sql', '003_c.sql']);
	await fs.rm(dir, { recursive: true, force: true });
});

test('pending(): a database with NO migrations table has everything pending', async () => {
	// This is the state a brand-new deployment is in, and the one where the
	// answer matters most — it must not throw, because a health route calls it.
	const { MigrationRunner } = await import('../migrations/runner');
	const fs = await import('node:fs/promises');
	const dir = await fs.mkdtemp(join(tmpdir(), 'fonderie-mig-'));
	await fs.writeFile(join(dir, '001_a.sql'), 'SELECT 1;');

	const store = {
		query: async () => {
			throw new Error('relation "fonderie_migrations" does not exist');
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(store),
	};

	assert.deepEqual(await new MigrationRunner(store as never, dir).pending(), ['001_a.sql']);
	await fs.rm(dir, { recursive: true, force: true });
});

test('pending(): applies nothing — it is safe on the request path', async () => {
	const { MigrationRunner } = await import('../migrations/runner');
	const fs = await import('node:fs/promises');
	const dir = await fs.mkdtemp(join(tmpdir(), 'fonderie-mig-'));
	await fs.writeFile(join(dir, '001_a.sql'), 'SELECT 1;');

	const seen: string[] = [];
	const store = {
		query: async <T>(sql: string): Promise<T[]> => {
			seen.push(sql);
			return [] as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(store),
	};
	await new MigrationRunner(store as never, dir).pending();

	const wrote = seen.some((q) => /CREATE TABLE|INSERT INTO|ALTER TABLE/i.test(q));
	assert.equal(wrote, false, 'pending() must not create or modify anything');
});

// ── migration ordering ────────────────────────────────────────────
//
// Files are applied in LEXICOGRAPHIC order, so "1100_" sorts before "200_".
// A migration numbered past the widest existing prefix therefore runs FIRST,
// before the tables it alters exist — and it is invisible on any database that
// already has the earlier ones applied. It breaks on a FRESH database: CI, a
// new contributor, a restore from backup.
//
// That is not hypothetical. It turned an app's CI red while production stayed
// green for hours, because production had applied 200_ long before 1100_ was
// written.

test('refuses migrations whose name order contradicts their number', async () => {
	const { assertOrderIsUnambiguous } = await import('../migrations/runner');
	// The real case: 1000_ and 1100_ added after 900_, widening the prefix.
	const files = ['100_a.sql', '200_create_tasks.sql', '900_c.sql', '1000_d.sql', '1100_alter_tasks.sql'].sort();
	assert.throws(
		() => assertOrderIsUnambiguous(files, '/migrations'),
		/out of order/,
		'a fresh database would apply 1100_ before 200_ created the table it alters',
	);
});

test('names the file that actually moved, and how to renumber it', async () => {
	const { assertOrderIsUnambiguous } = await import('../migrations/runner');
	try {
		assertOrderIsUnambiguous(['200_a.sql', '1000_b.sql'].sort(), '/migrations');
		assert.fail('should have thrown');
	} catch (err) {
		const message = (err as Error).message;
		assert.match(message, /1000_b\.sql/, 'the offending file must be named — a guard you cannot act on is noise');
		assert.match(message, /pad every prefix|without widening/, 'and it must say how to fix it');
	}
});

test('a consistent scheme is never flagged, however it is padded', async () => {
	const { assertOrderIsUnambiguous } = await import('../migrations/runner');
	// Equal lexicographic and numeric order is the only thing that matters, so
	// none of these are anyone's problem.
	for (const files of [
		['100_a.sql', '200_b.sql', '900_c.sql', '910_d.sql', '920_e.sql'],
		['0100_a.sql', '0200_b.sql', '1000_c.sql', '1100_d.sql'],
		['20250101120000_a.sql', '20250601090000_b.sql'],
		['init.sql', 'schema.sql'],
		['200_only.sql'],
		[],
	]) {
		assert.doesNotThrow(() => assertOrderIsUnambiguous([...files].sort(), '/migrations'), files.join(','));
	}
});

