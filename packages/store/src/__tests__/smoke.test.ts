import { test } from 'node:test';
import assert from 'node:assert/strict';

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
