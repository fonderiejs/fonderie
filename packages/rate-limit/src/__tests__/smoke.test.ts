import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { consumeFromBucket } from '../bucket';
import { byBodyField, byIp, rateLimit } from '../middleware';
import { MemoryStore } from '../stores/memory';
import { StoreAdapterStore } from '../stores/store-adapter';
import { RedisStore } from '../stores/redis';
import type { IRateLimitRule } from '../types';

const RULE: IRateLimitRule = { capacity: 5, refillPerSec: 1 };

// ── bucket math ──────────────────────────────────────────────────

test('bucket: fresh key starts full and pays cost', () => {
	const { next, result } = consumeFromBucket(null, RULE, 1_000_000);
	assert.equal(result.allowed, true);
	assert.equal(result.remaining, 4);
	assert.equal(next.tokens, 4);
});

test('bucket: refills over time, capped at capacity', () => {
	const { next: drained } = consumeFromBucket(
		{ tokens: 0, lastRefillMs: 0 },
		RULE,
		0,
	);
	// 3 seconds later at 1 token/sec → 3 tokens (never above capacity 5)
	const { result } = consumeFromBucket(drained, RULE, 3_000);
	assert.equal(result.allowed, true);
	const { result: farFuture } = consumeFromBucket(drained, RULE, 3_600_000);
	assert.equal(farFuture.remaining, RULE.capacity - 1);
});

test('bucket: denies with a sane retryAfter when empty', () => {
	const { result } = consumeFromBucket({ tokens: 0, lastRefillMs: 1_000 }, RULE, 1_000);
	assert.equal(result.allowed, false);
	assert.equal(result.remaining, 0);
	assert.ok(result.retryAfterMs > 0 && result.retryAfterMs <= 1_000);
});

// ── MemoryStore ──────────────────────────────────────────────────

test('memory: enforces capacity then denies', async () => {
	const store = new MemoryStore();
	for (let i = 0; i < RULE.capacity; i++) {
		assert.equal((await store.consume('k', RULE)).allowed, true, `grant ${i + 1}`);
	}
	assert.equal((await store.consume('k', RULE)).allowed, false);
});

test('memory: keys are independent', async () => {
	const store = new MemoryStore();
	for (let i = 0; i < RULE.capacity; i++) await store.consume('a', RULE);
	assert.equal((await store.consume('a', RULE)).allowed, false);
	assert.equal((await store.consume('b', RULE)).allowed, true);
});

// ── StoreAdapterStore — against an in-process adapter that emulates the
// upsert's row-lock semantics, so the race test exercises the same
// serialize-per-key guarantee Postgres provides. ────────────────────

function pgEmulator(): IStoreAdapter & { rows: Map<string, { tokens: number; last: number }> } {
	const rows = new Map<string, { tokens: number; last: number }>();
	// One promise chain per key = row-level lock: concurrent upserts on the
	// same key are applied strictly one at a time, like Postgres.
	const locks = new Map<string, Promise<unknown>>();
	const adapter = {
		rows,
		async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
			if (sql.startsWith('DELETE')) {
				const cutoff = params![0] as number;
				for (const [k, r] of rows) if (r.last < cutoff) rows.delete(k);
				return [];
			}
			const [key, capacity, now, cost, refillPerSec] = params as [
				string, number, number, number, number,
			];
			const prev = locks.get(key) ?? Promise.resolve();
			const run = prev.then(async () => {
				const row = rows.get(key);
				if (!row) {
					const granted = capacity >= cost;
					rows.set(key, { tokens: Math.max(0, capacity - cost), last: now });
					return [{ tokens: Math.max(0, capacity - cost), granted }];
				}
				const refilled = Math.min(
					capacity,
					row.tokens + (Math.max(0, now - row.last) / 1000) * refillPerSec,
				);
				const granted = refilled >= cost;
				const tokens = granted ? refilled - cost : refilled;
				rows.set(key, { tokens, last: now });
				return [{ tokens, granted }];
			});
			locks.set(key, run);
			return (await run) as T[];
		},
		async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
			return fn(adapter);
		},
	};
	return adapter as IStoreAdapter & { rows: Map<string, { tokens: number; last: number }> };
}

test('store-adapter: enforces capacity then denies', async () => {
	const store = new StoreAdapterStore(pgEmulator());
	for (let i = 0; i < RULE.capacity; i++) {
		assert.equal((await store.consume('k', RULE)).allowed, true);
	}
	const denied = await store.consume('k', RULE);
	assert.equal(denied.allowed, false);
	assert.ok(denied.retryAfterMs > 0);
});

test('store-adapter RACE: N concurrent consumes never over-grant', async () => {
	const store = new StoreAdapterStore(pgEmulator());
	const attempts = 50;
	const results = await Promise.all(
		Array.from({ length: attempts }, () => store.consume('hot-key', RULE)),
	);
	const granted = results.filter((r) => r.allowed).length;
	assert.equal(granted, RULE.capacity, `granted ${granted}, expected exactly ${RULE.capacity}`);
});

// ── RedisStore — eval client emulating atomic script execution ────

function redisEmulator() {
	const hashes = new Map<string, { tokens: number; last: number }>();
	let chain: Promise<unknown> = Promise.resolve();
	return {
		hashes,
		eval(_script: string, _numKeys: number, ...args: (string | number)[]) {
			// Redis runs scripts serially — model that with one global chain.
			const run = chain.then(async () => {
				const [key, capacity, now, cost, refillPerSec] = [
					args[0] as string,
					Number(args[1]),
					Number(args[2]),
					Number(args[3]),
					Number(args[4]),
				];
				const row = hashes.get(key);
				const tokens = row ? row.tokens : capacity;
				const last = row ? row.last : now;
				const refilled = Math.min(capacity, tokens + (Math.max(0, now - last) / 1000) * refillPerSec);
				const allowed = refilled >= cost ? 1 : 0;
				const newTokens = allowed ? refilled - cost : refilled;
				hashes.set(key, { tokens: newTokens, last: now });
				return [allowed, String(newTokens)];
			});
			chain = run;
			return run;
		},
	};
}

test('redis: enforces capacity then denies; race-safe under serial eval', async () => {
	const store = new RedisStore(redisEmulator());
	const results = await Promise.all(
		Array.from({ length: 30 }, () => store.consume('k', RULE)),
	);
	assert.equal(results.filter((r) => r.allowed).length, RULE.capacity);
});

// ── middleware ───────────────────────────────────────────────────

function makeCtx(opts: { ip?: string; body?: Record<string, unknown> } = {}): any {
	return {
		user: null,
		workspace: null,
		tenant: null,
		meta: { body: opts.body ?? {}, ...(opts.ip ? { clientIp: opts.ip } : {}) },
		request: new Request('http://localhost/'),
	};
}

test('middleware: 429 with IETF headers after capacity, per IP', async () => {
	const store = new MemoryStore();
	const mw = rateLimit({ store, rule: RULE, key: byIp('login') });

	let res: Response = new Response();
	for (let i = 0; i < RULE.capacity + 1; i++) {
		res = await mw(makeCtx({ ip: '203.0.113.7' }), async () => new Response('ok'));
	}
	assert.equal(res.status, 429);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'RATE_LIMITED');
	assert.equal(res.headers.get('RateLimit-Limit'), String(RULE.capacity));
	assert.equal(res.headers.get('RateLimit-Remaining'), '0');
	assert.ok(Number(res.headers.get('RateLimit-Reset')) > 0);
	assert.ok(Number(res.headers.get('Retry-After')) > 0);
	// a different IP is unaffected
	const other = await mw(makeCtx({ ip: '198.51.100.9' }), async () => new Response('ok'));
	assert.equal(other.status, 200);
});

test('middleware: dual limits — account key trips independently of IP', async () => {
	const store = new MemoryStore();
	const mw = rateLimit(
		{ store, rule: { capacity: 100, refillPerSec: 1 }, key: byIp('login') },
		{ store, rule: { capacity: 2, refillPerSec: 0.01 }, key: byBodyField('login', 'email') },
	);
	const hit = (ip: string) =>
		mw(makeCtx({ ip, body: { email: 'Jane@Example.com ' } }), async () => new Response('ok'));
	// same account from rotating IPs — per-account bucket must still trip
	assert.equal((await hit('10.0.0.1')).status, 200);
	assert.equal((await hit('10.0.0.2')).status, 200);
	assert.equal((await hit('10.0.0.3')).status, 429);
});

test('middleware: missing clientIp skips the IP limiter (no shared-bucket collapse)', async () => {
	const store = new MemoryStore();
	const mw = rateLimit({ store, rule: { capacity: 1, refillPerSec: 0.001 }, key: byIp('login') });
	assert.equal((await mw(makeCtx(), async () => new Response('ok'))).status, 200);
	assert.equal((await mw(makeCtx(), async () => new Response('ok'))).status, 200);
});

test('middleware: fail-open on store errors by default, fail-closed opt-in', async () => {
	const broken = { consume: async () => { throw new Error('store down'); } };
	const open = rateLimit({ store: broken, rule: RULE, key: byIp('x') });
	assert.equal((await open(makeCtx({ ip: '1.2.3.4' }), async () => new Response('ok'))).status, 200);
	const closed = rateLimit({ store: broken, rule: RULE, key: byIp('x'), failClosed: true });
	assert.equal((await closed(makeCtx({ ip: '1.2.3.4' }), async () => new Response('ok'))).status, 429);
});
