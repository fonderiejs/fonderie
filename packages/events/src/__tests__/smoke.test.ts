import { describe, it, before, after, test } from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../bus';
import { EventsModule } from '../module';
import { MemoryTransport } from '../transports/memory';
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
