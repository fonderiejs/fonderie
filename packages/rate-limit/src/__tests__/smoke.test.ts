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
			// Store now sources time itself (clock_timestamp() in real PG); the
			// emulator models that single authoritative clock with Date.now().
			const now = Date.now();
			if (sql.trim().startsWith('DELETE')) {
				const idleMs = params![0] as number;
				for (const [k, r] of rows) if (r.last < now - idleMs) rows.delete(k);
				return [];
			}
			const [key, capacity, cost, refillPerSec] = params as [string, number, number, number];
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
			// The Lua sources time via redis.call('TIME'); emulate that single
			// server clock with Date.now() (args no longer carry `now`).
			const run = chain.then(async () => {
				const now = Date.now();
				const [key, capacity, cost, refillPerSec] = [
					args[0] as string,
					Number(args[1]),
					Number(args[2]),
					Number(args[3]),
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

// ── hardening: hashed/bounded keys, IPv6 /64 ─────────────────────

test('byBodyField: normalizes and produces a fixed-width hashed key', async () => {
	const { byBodyField } = await import('../middleware');
	const k = byBodyField('login', 'email');
	const a = k(makeCtx({ body: { email: 'Jane@Example.com ' } }));
	const b = k(makeCtx({ body: { email: 'jane@example.com' } }));
	assert.equal(a, b, 'case/whitespace normalize to the same bucket');
	assert.ok(a && a.startsWith('login:email:'), 'scope stays readable');
	// the identifying tail is a base64url sha256 digest (43 chars), not the email
	const tail = a!.split(':').pop()!;
	assert.equal(tail.length, 43);
	assert.ok(!tail.includes('@'), 'raw email must not appear in the key');
});

test('byBodyField: oversized value is bounded, not passed through', async () => {
	const { byBodyField } = await import('../middleware');
	const k = byBodyField('login', 'email');
	const huge = 'x'.repeat(100_000) + '@evil.com';
	const key = k(makeCtx({ body: { email: huge } }));
	assert.ok(key, 'still produces a key');
	assert.ok(key!.length < 80, 'key is bounded regardless of input size');
});

test('byBodyField: non-string field is skipped (null key)', async () => {
	const { byBodyField } = await import('../middleware');
	const k = byBodyField('login', 'email');
	assert.equal(k(makeCtx({ body: { email: { nested: 'obj' } } })), null);
	assert.equal(k(makeCtx({ body: {} })), null);
});

test('byIp: IPv6 keys on the /64 prefix (addresses in one /64 share a bucket)', async () => {
	const { byIp } = await import('../middleware');
	const k = byIp('login');
	const a = k(makeCtx({ ip: '2001:db8:abcd:1234::1' }));
	const b = k(makeCtx({ ip: '2001:db8:abcd:1234:ffff:ffff:ffff:ffff' }));
	const other = k(makeCtx({ ip: '2001:db8:abcd:9999::1' }));
	assert.equal(a, b, 'same /64 → same bucket (defeats residential /64 rotation)');
	assert.notEqual(a, other, 'different /64 → different bucket');
});

test('byIp: IPv4 keys on the full address', async () => {
	const { byIp } = await import('../middleware');
	const k = byIp('login');
	assert.notEqual(k(makeCtx({ ip: '203.0.113.1' })), k(makeCtx({ ip: '203.0.113.2' })));
});

// ── eviction / cleanup / failure paths (the "every N ops" branches) ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('memory: sweep evicts idle keys, keeps fresh ones', async () => {
	const store = new MemoryStore();
	// fullRefillMs = capacity/refillPerSec*1000 = 5/50*1000 = 100ms.
	const rule: IRateLimitRule = { capacity: 5, refillPerSec: 50 };
	await store.consume('stale', rule);
	await sleep(130); // 'stale' now idle past a full refill
	// Drive exactly one sweep (SWEEP_EVERY=1024) with fresh rotating keys.
	for (let i = 0; i < 1024; i++) await store.consume(`k${i}`, rule);
	// 1 stale + 1024 fresh would be 1025 without a sweep; the sweep drops
	// 'stale' (idle) while keeping the just-created keys.
	assert.ok(store.size <= 1024, `sweep should have evicted the idle key (size ${store.size})`);
	assert.ok(store.size >= 1000, 'fresh keys must survive the sweep');
});

test('store-adapter: opportunistic cleanup deletes idle rows', async () => {
	const emu = pgEmulator();
	const store = new StoreAdapterStore(emu);
	const rule: IRateLimitRule = { capacity: 5, refillPerSec: 50 }; // idleMs = 100ms
	await store.consume('stale-row', rule);
	assert.ok(emu.rows.has('stale-row'));
	await sleep(130);
	// CLEAN_EVERY=512 — trigger one cleanup pass.
	for (let i = 0; i < 512; i++) await store.consume(`live${i}`, rule);
	// give the fire-and-forget DELETE a tick to apply
	await sleep(5);
	assert.equal(emu.rows.has('stale-row'), false, 'idle row should be pruned');
});

test('store-adapter: throws if the upsert returns no row', async () => {
	const empty: IStoreAdapter = {
		query: async () => [],
		transaction: async (fn) => fn(empty),
	};
	await assert.rejects(
		() => new StoreAdapterStore(empty).consume('k', RULE),
		/returned no row/,
	);
});

test('bucket: cost > 1 consumes and denies correctly', () => {
	const rule: IRateLimitRule = { capacity: 10, refillPerSec: 1, cost: 4 };
	// fresh bucket (10) − cost 4 = 6 left
	const first = consumeFromBucket(null, rule, 0);
	assert.equal(first.result.allowed, true);
	assert.equal(first.result.remaining, 6);
	// from 6, another cost-4 → 2 left
	const second = consumeFromBucket(first.next, rule, 0);
	assert.equal(second.result.remaining, 2);
	// from 2, cost 4 → denied, retryAfter reflects the 2-token deficit
	const third = consumeFromBucket(second.next, rule, 0);
	assert.equal(third.result.allowed, false);
	assert.ok(third.result.retryAfterMs > 0);
});

test('middleware: a later limit denying still emits headers (first allows)', async () => {
	const store = new MemoryStore();
	const mw = rateLimit(
		{ store, rule: { capacity: 100, refillPerSec: 1 }, key: byIp('x') },       // always allows here
		{ store, rule: { capacity: 1, refillPerSec: 0.001 }, key: byBodyField('x', 'email') }, // trips 2nd call
	);
	const hit = () => mw(makeCtx({ ip: '1.1.1.1', body: { email: 'a@b.c' } }), async () => new Response('ok'));
	assert.equal((await hit()).status, 200);
	const denied = await hit();
	assert.equal(denied.status, 429);
	assert.equal(denied.headers.get('RateLimit-Limit'), '1', 'headers reflect the limit that tripped');
});

// ── defensive backstops ──────────────────────────────────────────

test('store-adapter: a failing cleanup does NOT break the request', async () => {
	// Emulator that serves consumes but rejects the periodic DELETE.
	const rows = new Map<string, { tokens: number; last: number }>();
	let ops = 0;
	const flaky: IStoreAdapter = {
		async query<T = unknown>(sql: string): Promise<T[]> {
			if (sql.trim().startsWith('DELETE')) throw new Error('cleanup boom');
			ops++;
			const row = rows.get('k') ?? { tokens: RULE.capacity, last: Date.now() };
			const tokens = Math.max(0, row.tokens - 1);
			rows.set('k', { tokens, last: Date.now() });
			return [{ tokens, granted: row.tokens >= 1 }] as T[];
		},
		async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
			return fn(flaky);
		},
	};
	const store = new StoreAdapterStore(flaky);
	// 512 consumes → triggers the cleanup DELETE, which rejects; consume must
	// still resolve normally (fire-and-forget .catch swallows it).
	let last: Awaited<ReturnType<StoreAdapterStore['consume']>> | undefined;
	for (let i = 0; i < 512; i++) last = await store.consume('k', RULE);
	assert.ok(last, 'consume resolved despite cleanup failure');
	assert.ok(ops >= 512);
});

test('byBodyField: empty and whitespace-only values yield no key', async () => {
	const { byBodyField } = await import('../middleware');
	const k = byBodyField('login', 'email');
	assert.equal(k(makeCtx({ body: { email: '' } })), null);
	assert.equal(k(makeCtx({ body: { email: '   ' } })), null, 'whitespace trims to empty → skip');
});

test('byIp: empty clientIp string yields no key', async () => {
	const { byIp } = await import('../middleware');
	assert.equal(byIp('login')(makeCtx({ ip: '' })), null);
});

test('byIp: IPv6 :: at either end (loopback, link-local) keys deterministically', async () => {
	const { byIp } = await import('../middleware');
	const k = byIp('login');
	// leading :: (empty left group) and trailing :: (empty right group)
	assert.ok(k(makeCtx({ ip: '::1' })), 'loopback ::1 yields a key');
	assert.ok(k(makeCtx({ ip: 'fe80::' })), 'link-local fe80:: yields a key');
	// same /64 collapses regardless of host bits
	assert.equal(k(makeCtx({ ip: 'fe80::1' })), k(makeCtx({ ip: 'fe80::abcd' })));
});
