import { describe, it, before, after, test } from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../bus';
import { EventsModule } from '../module';
import { MemoryTransport } from '../transports/memory';
import { PGTransport } from '../transports/pg';
import { matchesPattern } from '../transports/pattern';

// ── Pattern matching unit tests ────────────────────────────────────────

describe('matchesPattern', () => {
	it('* matches everything', () => {
		assert.ok(matchesPattern('*', 'auth.user.registered'));
		assert.ok(matchesPattern('*', 'x'));
	});

	it('exact match', () => {
		assert.ok(matchesPattern('auth.user.registered', 'auth.user.registered'));
		assert.ok(!matchesPattern('auth.user.registered', 'auth.user.deleted'));
	});

	it('prefix wildcard — sport.*', () => {
		assert.ok(matchesPattern('sport.*', 'sport.event.created'));
		assert.ok(matchesPattern('sport.*', 'sport.highlights.published'));
		assert.ok(!matchesPattern('sport.*', 'news.article.created'));
	});

	it('suffix wildcard — *.created', () => {
		assert.ok(matchesPattern('*.created', 'auth.user.created'));
		assert.ok(matchesPattern('*.created', 'news.article.created'));
		assert.ok(!matchesPattern('*.created', 'news.article.updated'));
	});

	it('middle wildcard — sport.*.created', () => {
		assert.ok(matchesPattern('sport.*.created', 'sport.event.created'));
		assert.ok(matchesPattern('sport.*.created', 'sport.highlights.created'));
		assert.ok(!matchesPattern('sport.*.created', 'sport.event.updated'));
		assert.ok(!matchesPattern('sport.*.created', 'news.article.created'));
	});
});

// ── EventBus (memory transport) ────────────────────────────────────────

describe('EventBus — memory transport', () => {
	let bus: EventBus;

	before(async () => {
		bus = new EventBus(new MemoryTransport());
		await bus.start();
	});

	after(async () => {
		await bus.stop();
	});

	it('delivers a typed event to an exact-match handler', async () => {
		const received: unknown[] = [];
		bus.on<{ userId: string }>('user.registered', async (payload) => {
			received.push(payload);
		});

		await bus.emit('user.registered', { userId: 'u-1' });

		assert.equal(received.length, 1);
		assert.deepEqual(received[0], { userId: 'u-1' });
	});

	it('delivers to wildcard * handler', async () => {
		const types: string[] = [];
		bus.on<unknown>(
			'*',
			async (_payload, meta) => {
				types.push(meta.type);
			},
			'global-logger',
		);

		await bus.emit('user.deleted', { userId: 'u-2' });
		await bus.emit('user.verified', { userId: 'u-3' });

		assert.ok(types.includes('user.deleted'));
		assert.ok(types.includes('user.verified'));
	});

	it('delivers to prefix pattern — auth.*', async () => {
		const received: string[] = [];
		bus.on<unknown>(
			'auth.*',
			async (_p, meta) => {
				received.push(meta.type);
			},
			'auth-consumer',
		);

		await bus.emit('auth.user.registered', {});
		await bus.emit('billing.subscription.created', {});

		assert.ok(received.includes('auth.user.registered'));
		assert.ok(!received.includes('billing.subscription.created'));
	});

	it('delivers to suffix pattern — *.created', async () => {
		const received: string[] = [];
		bus.on<unknown>(
			'*.created',
			async (_p, meta) => {
				received.push(meta.type);
			},
			'created-indexer',
		);

		await bus.emit('news.article.created', {});
		await bus.emit('sport.event.created', {});
		await bus.emit('news.article.updated', {});

		assert.ok(received.includes('news.article.created'));
		assert.ok(received.includes('sport.event.created'));
		assert.ok(!received.includes('news.article.updated'));
	});

	it('does not deliver to unrelated handlers', async () => {
		const received: unknown[] = [];
		bus.on<unknown>(
			'order.created',
			async (p) => {
				received.push(p);
			},
			'orders',
		);

		await bus.emit('invoice.created', { id: 'inv-1' });

		assert.equal(received.length, 0);
	});

	it('passes requestId through meta', async () => {
		let capturedMeta: { requestId?: string } | undefined;
		bus.on<unknown>(
			'ping',
			async (_p, meta) => {
				capturedMeta = meta;
			},
			'ping-consumer',
		);

		await bus.emit('ping', {}, { requestId: 'req-abc' });

		assert.equal(capturedMeta?.requestId, 'req-abc');
	});
});

// ── EventsModule ──────────────────────────────────────────────────────────

test('EventsModule: accepts a custom IEventTransport (MemoryTransport as test stand-in)', () => {
	const mod = new EventsModule({ transport: new MemoryTransport() });
	assert.equal(mod.name, '@fonderie/events');
	assert.ok(mod.bus instanceof EventBus);
	assert.ok(typeof mod.install === 'function');
});

// ── Audit-log tamper-evidence (HMAC) ───────────────────────────────────

import { computeEventHmac, canonicalize, verifyEventChain } from '../integrity';
import type { IStoreAdapter } from '@fonderie/store';

describe('event integrity HMAC', () => {
	const key = 'k'.repeat(48);
	const ev = { id: 'e1', type: 'fonderie.user.registered', payload: { userId: 'u1', b: 2, a: 1 }, meta: { id: 'e1', requestId: 'r1' } };

	it('canonicalize is order-independent', () => {
		assert.equal(canonicalize({ a: 1, b: 2 }), canonicalize({ b: 2, a: 1 }));
		assert.equal(canonicalize({ x: { c: 3, a: 1 } }), '{"x":{"a":1,"c":3}}');
	});

	it('computeEventHmac is deterministic and key-dependent', () => {
		assert.equal(computeEventHmac(key, ev), computeEventHmac(key, ev));
		assert.notEqual(computeEventHmac(key, ev), computeEventHmac('other-key-'.padEnd(48, 'x'), ev));
	});

	it('a modified payload changes the HMAC', () => {
		const tampered = { ...ev, payload: { ...ev.payload, userId: 'attacker' } };
		assert.notEqual(computeEventHmac(key, tampered), computeEventHmac(key, ev));
	});

	it('verifyEventChain flags a row whose content no longer matches its HMAC', async () => {
		const good = computeEventHmac(key, ev);
		const ev2 = { id: 'e2', type: 'x', payload: {}, meta: { id: 'e2' } };
		const rows = [
			{ ...ev, hmac: good, created_at: '2026-01-01' },
			{ ...ev2, hmac: 'deadbeef', created_at: '2026-01-02' }, // wrong hmac
			{ id: 'e0', type: 'legacy', payload: {}, meta: {}, hmac: null, created_at: '2025-01-01' }, // pre-integrity
		];
		const store: IStoreAdapter = {
			query: async <T = unknown>() => rows as unknown as T[],
			transaction: async (fn) => fn(store),
		};
		const report = await verifyEventChain(store, key);
		assert.equal(report.ok, false);
		assert.equal(report.checked, 2);
		assert.equal(report.unprotected, 1);
		assert.deepEqual(report.tampered, ['e2']);
	});
});

describe('EventsModule.checkReadiness', () => {
	it('warns when pg transport has no integrityKey', () => {
		const mod = new EventsModule({ transport: { type: 'pg', connectionUrl: 'postgres://localhost/x' } });
		const problems = mod.checkReadiness();
		assert.ok(problems.some((p) => p.severity === 'warning' && /integrityKey/.test(p.message)));
	});
	it('clean when integrityKey is set', () => {
		const mod = new EventsModule({ transport: { type: 'pg', connectionUrl: 'postgres://localhost/x', integrityKey: 'k'.repeat(48) } });
		assert.deepEqual(mod.checkReadiness(), []);
	});
});

// ── Retention / disposal ───────────────────────────────────────────────
import { purgeEvents } from '../retention';
import type { IStoreAdapter as IStore2 } from '@fonderie/store';

describe('purgeEvents', () => {
	it('deletes events older than the window and returns the count', async () => {
		let captured: { sql: string; params: unknown[] } | null = null;
		const store: IStore2 = {
			query: async <T = unknown>(sql: string, params?: unknown[]) => {
				captured = { sql, params: params ?? [] };
				return [{ id: 'a' }, { id: 'b' }] as unknown as T[];
			},
			transaction: async (fn) => fn(store),
		};
		const n = await purgeEvents(store, { olderThanDays: 90 });
		assert.equal(n, 2);
		assert.match(captured!.sql, /DELETE FROM fonderie_events/);
		assert.match(captured!.sql, /make_interval\(days => \$1\)/);
		assert.deepEqual(captured!.params, [90]);
	});
	it('rejects a negative window', async () => {
		const store: IStore2 = { query: async () => [], transaction: async (fn) => fn(store) };
		await assert.rejects(() => purgeEvents(store, { olderThanDays: -1 }), /non-negative/);
	});
});

// ── B4: scheduled integrity check ───────────────────────────────────────
import { startIntegrityCheck } from '../integrity-job';
import { computeEventHmac as chmac } from '../integrity';
import { startEventRetention } from '../retention';
import type { IStoreAdapter as IStore3 } from '@fonderie/store';

describe('startIntegrityCheck (B4)', () => {
	const key = 'k'.repeat(48);
	it('fires onTamper when a row fails verification, and stops cleanly', async () => {
		const good = chmac(key, { id: 'e1', type: 't', payload: {}, meta: {} });
		const store: IStore3 = {
			query: async <T = unknown>() => ([
				{ id: 'e1', type: 't', payload: {}, meta: {}, hmac: good },
				{ id: 'e2', type: 't', payload: {}, meta: {}, hmac: 'deadbeef' },
			] as unknown as T[]),
			transaction: async (fn) => fn(store),
		};
		const tamper = new Promise<string[]>((resolve) => {
			const h = startIntegrityCheck(store, key, {
				intervalMs: 1_000_000,
				onTamper: (r) => { resolve(r.tampered); h.stop(); },
			});
		});
		assert.deepEqual(await tamper, ['e2']);
	});
});

describe('startEventRetention (C1)', () => {
	it('runs purge immediately and reports the count', async () => {
		const store: IStore3 = {
			query: async <T = unknown>() => ([{ id: 'a' }, { id: 'b' }] as unknown as T[]),
			transaction: async (fn) => fn(store),
		};
		const purged = new Promise<number>((resolve) => {
			const h = startEventRetention(store, { olderThanDays: 90, intervalMs: 1_000_000, onPurge: (n) => { resolve(n); h.stop(); } });
		});
		assert.equal(await purged, 2);
	});
});

// ── drain(): the consumer for a process that must return ────────────────────
// An outbox is the one design that does not branch on deployment topology —
// producers always write a durable row. What varies is WHO consumes it:
// start() on a host that outlives the request, drain() from a scheduled ping
// where nothing long-running exists. Neither side's code changes.

test('EventBus.drain(): a transport with nothing durable is a harmless no-op', async () => {
	const bus = new EventBus(new MemoryTransport());
	let delivered = 0;
	bus.on('x.y', async () => { delivered += 1; });
	await bus.emit('x.y', {});
	// MemoryTransport delivers inline and implements no drain — calling it must
	// neither throw nor double-deliver.
	await bus.drain();
	assert.equal(delivered, 1);
});

test('EventBus.drain(): forwards the bound to the transport', async () => {
	const calls: Array<{ maxMs?: number } | undefined> = [];
	const transport = {
		publish: async () => {},
		subscribe: () => {},
		start: async () => {},
		stop: async () => {},
		drain: async (o?: { maxMs?: number }) => { calls.push(o); },
	};
	const bus = new EventBus(transport as never);
	await bus.drain({ maxMs: 1234 });
	assert.deepEqual(calls, [{ maxMs: 1234 }]);
});

// ── Producer-only mode ──────────────────────────────────────────────────────
// A serverless API must write durable rows but cannot host a consumer: a poll
// loop never returns, and LISTEN is rejected outright by a transaction-mode
// pooler. consume:false connects far enough to publish and stops there.

test('PGTransport: consume:false connects to publish without starting a consumer', async () => {
	const transport = new PGTransport({ connectionUrl: 'postgres://unused/test', consume: false });
	let listened = false;
	// start() must not reach the LISTEN client or the poll loop. If it did,
	// this would attempt a real connection and throw.
	const original = (transport as unknown as { runPollLoop?: unknown }).runPollLoop;
	(transport as unknown as { runPollLoop: () => Promise<void> }).runPollLoop = async () => {
		listened = true;
	};
	try {
		await transport.start();
		assert.equal(listened, false, 'a producer must not start the poll loop');
	} finally {
		(transport as unknown as { runPollLoop?: unknown }).runPollLoop = original;
		await transport.stop().catch(() => undefined);
	}
});

test('PGTransport: dead-letter and backlog reads are safe before connecting', async () => {
	// Before start() there is no store — these must answer emptily rather than
	// throw, so a health route can call them unconditionally.
	const transport = new PGTransport({ connectionUrl: 'postgres://unused/test' });
	assert.deepEqual(await transport.deadLetters(), []);
	assert.equal(await transport.pendingCount(), 0);
});

// ── Outbox delivery safety ─────────────────────────────────────────────

/** Captures the SQL a transport issues, so we can assert on it without a DB. */
class RecordingStore {
	readonly queries: string[] = [];
	async query<T>(sql: string, _params?: unknown[]): Promise<T[]> {
		this.queries.push(sql);
		return [];
	}
}

function withStore(transport: PGTransport, store: RecordingStore): void {
	(transport as unknown as { store: RecordingStore }).store = store;
}

test('PGTransport: drain() before connecting is a no-op, not a crash', async () => {
	// Same contract as deadLetters()/pendingCount(): a caller should not have to
	// know whether boot got far enough before asking for a drain.
	const transport = new PGTransport({ connectionUrl: 'postgres://unused/test' });
	await transport.drain({ maxMs: 5 });
});

test('PGTransport: drain() never blanket-resets in-flight rows', async () => {
	// drain() is the serverless consumer, so several instances run it at once.
	// A reset of every 'processing' row would take rows the other instances are
	// mid-send on and hand them to this one — the same email, sent twice.
	const transport = new PGTransport({ connectionUrl: 'postgres://unused/test' });
	const store = new RecordingStore();
	withStore(transport, store);
	transport.subscribe('*', async () => undefined, 'courier');

	await transport.drain({ maxMs: 50 });

	const blanketReset = store.queries.find(
		(q) => /SET\s+status\s*=\s*'failed'/i.test(q) && /WHERE\s+status\s*=\s*'processing'/i.test(q),
	);
	assert.equal(blanketReset, undefined, 'drain() must not reclaim by resetting every processing row');

	// It must still reclaim abandoned work — by age, under the row lock.
	const claim = store.queries.find((q) => /SET status = 'processing'/.test(q));
	assert.ok(claim, 'drain() should claim rows');
	assert.match(claim, /claimed_at\s*<\s*now\(\)/, 'reclaim must be bounded by a visibility timeout');
	assert.match(claim, /FOR UPDATE SKIP LOCKED/, 'the reclaim must be exclusive');
});

test('PGTransport: every column the transport reads is one the migrations create', async () => {
	// The bug this exists for: deadLetters() selected `c.last_error` while the
	// table defines `error`. Nothing caught it, because the only thing that
	// would is a live database — the query parses fine and the types line up.
	const fs = await import('node:fs');
	const path = await import('node:path');
	const url = await import('node:url');

	const sqlDir = path.join(
		path.dirname(url.fileURLToPath(import.meta.url)),
		'..',
		'migrations',
		'sql',
	);
	const sql = fs
		.readdirSync(sqlDir)
		.filter((f) => f.endsWith('.sql'))
		.map((f) => fs.readFileSync(path.join(sqlDir, f), 'utf8'))
		.join('\n');

	const declared = new Set<string>();
	const createBlock = /CREATE TABLE IF NOT EXISTS fonderie_event_consumers \(([\s\S]*?)\n\);/.exec(sql);
	assert.ok(createBlock, 'expected a fonderie_event_consumers table definition');
	for (const line of (createBlock[1] ?? '').split('\n')) {
		const col = /^\s+(\w+)\s+(UUID|TEXT|INT|TIMESTAMPTZ|BOOLEAN|JSONB)/.exec(line);
		if (col?.[1]) declared.add(col[1]);
	}
	for (const added of sql.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)) {
		if (added[1]) declared.add(added[1]);
	}

	const transport = new PGTransport({ connectionUrl: 'postgres://unused/test' });
	const store = new RecordingStore();
	withStore(transport, store);
	transport.subscribe('*', async () => undefined, 'courier');
	await transport.deadLetters();
	await transport.pendingCount();
	await transport.drain({ maxMs: 50 });

	// Only `c.`-qualified references — `e.` ones belong to fonderie_events.
	const referenced = new Set<string>();
	for (const q of store.queries) {
		for (const m of q.matchAll(/\bc\.(\w+)\b/g)) {
			if (m[1]) referenced.add(m[1]);
		}
	}
	assert.ok(referenced.size > 0, 'expected the transport to reference consumer columns');
	for (const col of referenced) {
		assert.ok(
			declared.has(col),
			`fonderie_event_consumers.${col} is read by the transport but no migration creates it`,
		);
	}
});

// ── Declarative transport config ───────────────────────────────────────

test('EventsModule: the { type: "pg" } form honours consume:false', async () => {
	// The class form (new PGTransport({ consume: false })) always worked. This
	// is the form the examples, the templates and the docs use — and producer
	// only mode was unreachable from it, which made the option effectively
	// missing for most apps.
	const mod = new EventsModule({
		transport: { type: 'pg', connectionUrl: 'postgres://unused/test', consume: false },
	});
	const transport = (mod as unknown as { bus: { transport: PGTransport } }).bus.transport;

	let looped = false;
	(transport as unknown as { runPollLoop: () => Promise<void> }).runPollLoop = async () => {
		looped = true;
	};
	try {
		await transport.start();
		assert.equal(looped, false, 'consume:false must not start a consumer');
	} finally {
		await transport.stop().catch(() => undefined);
	}
});

test('EventsModule: every declarative pg option is forwarded to the transport', async () => {
	// The bug this exists for: `consume` was added to IPGTransportConfig and to
	// the declarative union, but resolveTransport never forwarded it — so the
	// option type-checked at the call site and silently did nothing. Options
	// declared in one place and forwarded in another drift apart by default.
	const fs = await import('node:fs');
	const path = await import('node:path');
	const url = await import('node:url');

	const source = fs.readFileSync(
		path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'module.ts'),
		'utf8',
	);

	const union = /type: 'pg';([\s\S]*?)\n\t  \}/.exec(source);
	assert.ok(union, "expected the { type: 'pg' } union member");
	const declared = [...(union[1] ?? '').matchAll(/^\t\t\t(\w+)\?:/gm)].map((m) => m[1]);
	assert.ok(declared.length > 0, 'expected optional keys on the declarative form');

	const resolver = /function resolveTransport\(([\s\S]*?)\n\}/.exec(source);
	assert.ok(resolver, 'expected resolveTransport');
	for (const key of declared) {
		assert.ok(
			(resolver[1] ?? '').includes(`config.${key}`),
			`{ type: 'pg' } accepts "${key}" but resolveTransport never forwards it — it would be silently ignored`,
		);
	}
});
