import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';
import { DBCounterBackend, counterWindow, purgeUsageCounters } from '../backends/db';

// The 'db' counter backend: one row per (subscriber, metric, window), upserted
// atomically. Unit tests pin the window arithmetic and the SQL contract; the
// gated PostgreSQL tests below prove what only the engine can — that
// concurrent increments never lose a count.

const DAY = 86_400_000;

test('counterWindow: epoch-aligned fixed windows, matching resetsAt', () => {
	const midnight = Date.UTC(2026, 9, 2);
	const w = counterWindow(DAY, midnight + 5 * 3_600_000);
	assert.equal(w.start.getTime(), midnight);
	assert.equal(w.expiresAt!.getTime(), midnight + DAY);
});

test('counterWindow: the last ms of a window and the first ms of the next are different windows', () => {
	const midnight = Date.UTC(2026, 9, 2);
	assert.equal(counterWindow(DAY, midnight - 1).start.getTime(), midnight - DAY);
	assert.equal(counterWindow(DAY, midnight).start.getTime(), midnight);
});

test('counterWindow: a lifetime counter (null window) never expires', () => {
	const w = counterWindow(null);
	assert.equal(w.start.getTime(), 0);
	assert.equal(w.expiresAt, null);
});

test('DBCounterBackend.increment: one upsert that returns the new total; key metric may contain colons', async () => {
	const calls: Array<{ sql: string; params: unknown[] }> = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			calls.push({ sql, params });
			return [{ quantity: '7' }] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const backend = new DBCounterBackend(store, { opportunisticPurge: false });
	const total = await backend.increment('workspace:ws-1:api:v2', DAY, 3);
	assert.equal(total, 7);
	assert.equal(calls.length, 1, 'a single round-trip');
	assert.match(calls[0]!.sql, /ON CONFLICT .* DO UPDATE SET quantity = fonderie_usage_counters\.quantity \+ EXCLUDED\.quantity/s);
	const [type, id, metric, windowMs, start, qty, expires] = calls[0]!.params as [string, string, string, number, Date, number, Date];
	assert.deepEqual([type, id, metric, windowMs, qty], ['workspace', 'ws-1', 'api:v2', DAY, 3]);
	assert.equal(expires.getTime() - start.getTime(), DAY);
	assert.ok(!/fonderie_usage_records/.test(calls[0]!.sql), 'no longer appends to the usage ledger');
});

test('DBCounterBackend: opportunistic purge runs at most once per interval, never awaited', async () => {
	let purges = 0;
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('DELETE FROM fonderie_usage_counters')) {
				purges++;
				return [{ n: 0 }] as T[];
			}
			return [{ quantity: 1 }] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const backend = new DBCounterBackend(store);
	for (let i = 0; i < 5; i++) await backend.increment('user:u1:api-calls', DAY);
	await new Promise((r) => setTimeout(r, 0));
	assert.equal(purges, 1);
});

// ── Real engine ──────────────────────────────────────────────────

const PG_URL = process.env['BILLING_PG_URL'];
const SKIP = { skip: PG_URL ? false : 'set BILLING_PG_URL to run' };
const SUBSCRIBER = '5b0c7f1e-2d3a-4e5f-8a9b-0c1d2e3f4a5b';

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query(`DELETE FROM fonderie_usage_counters WHERE subscriber_id = $1`, [SUBSCRIBER]);
	return store;
}

test('PostgreSQL: concurrent increments never lose a count', SKIP, async () => {
	const store = await connect();
	try {
		const backend = new DBCounterBackend(store, { opportunisticPurge: false });
		const key = `workspace:${SUBSCRIBER}:api-calls`;
		const n = 50;
		const totals = await Promise.all(
			Array.from({ length: n }, () => backend.increment(key, DAY)),
		);
		assert.equal(await backend.get(key, DAY), n);
		// Every caller saw a distinct running total: 1..n, none skipped or repeated.
		assert.deepEqual([...totals].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1));
		const rows = await store.query<{ c: string }>(
			`SELECT COUNT(*) AS c FROM fonderie_usage_counters WHERE subscriber_id = $1`,
			[SUBSCRIBER],
		);
		assert.equal(Number(rows[0]!.c), 1, 'one row per window, not one per request');
	} finally {
		await (store as unknown as { end(): Promise<void> }).end();
	}
});

test('PostgreSQL: metrics and windows are counted apart (a 1h and a 1d window starting together too); quantity adds', SKIP, async () => {
	const store = await connect();
	try {
		const backend = new DBCounterBackend(store, { opportunisticPurge: false });
		await backend.increment(`user:${SUBSCRIBER}:exports`, DAY, 5);
		await backend.increment(`user:${SUBSCRIBER}:exports`, DAY, 2);
		await backend.increment(`user:${SUBSCRIBER}:imports`, DAY);
		await backend.increment(`user:${SUBSCRIBER}:exports`, 3_600_000);
		await backend.increment(`user:${SUBSCRIBER}:exports`, null, 4);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:exports`, DAY), 7);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:imports`, DAY), 1);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:exports`, 3_600_000), 1);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:exports`, null), 4);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:never`, DAY), 0);
	} finally {
		await (store as unknown as { end(): Promise<void> }).end();
	}
});

test('PostgreSQL: purgeUsageCounters drops ended windows only, never lifetime counters', SKIP, async () => {
	const store = await connect();
	try {
		const backend = new DBCounterBackend(store, { opportunisticPurge: false });
		await backend.increment(`user:${SUBSCRIBER}:api-calls`, DAY);
		await backend.increment(`user:${SUBSCRIBER}:lifetime`, null);
		// A window that ended yesterday.
		const old = counterWindow(DAY, Date.now() - 2 * DAY);
		await store.query(
			`INSERT INTO fonderie_usage_counters
				(subscriber_type, subscriber_id, metric, window_ms, window_start, quantity, expires_at)
			 VALUES ('user', $1, 'api-calls', $2, $3, 9, $4)`,
			[SUBSCRIBER, DAY, old.start, old.expiresAt],
		);
		const purged = await purgeUsageCounters(store);
		assert.ok(purged >= 1);
		const rows = await store.query<{ metric: string }>(
			`SELECT metric FROM fonderie_usage_counters WHERE subscriber_id = $1 ORDER BY metric`,
			[SUBSCRIBER],
		);
		assert.deepEqual(rows.map((r) => r.metric), ['api-calls', 'lifetime']);
		assert.equal(await backend.get(`user:${SUBSCRIBER}:api-calls`, DAY), 1, 'the live window survives');
	} finally {
		await (store as unknown as { end(): Promise<void> }).end();
	}
});
