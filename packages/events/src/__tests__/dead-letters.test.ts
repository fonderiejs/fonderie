import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PGTransport } from '../transports/pg';
import { getMigrationsPath } from '../migrations';
import { computeEventHmac, verifyEventChain } from '../integrity';

/**
 * Every delivery must end processed or VISIBLY dead — and a dead one must have
 * a way out. Against real Postgres, because every behaviour here is a SQL
 * state transition a stub would simply agree with.
 *
 * The limbo this guards: claiming requires attempts < maxRetries, and only a
 * handler that throws on its last attempt marks a row dead. A row whose last
 * attempt never finished (instance killed mid-send), or that an older release
 * reset to 'failed', was never retried, never dead, absent from the dead-letter
 * list — an email silently lost while the outbox check stayed green.
 *
 *   EVENTS_PG_URL=postgres://... npm test -w @fonderie/events
 */
const PG_URL = process.env['EVENTS_PG_URL'];
const skip = PG_URL ? false : 'set EVENTS_PG_URL to run';
const RUN = `deadtest-${process.pid}-${Math.floor(process.uptime() * 1000)}`;

function meta(type: string) {
	return { id: randomUUID(), type, emittedAt: new Date().toISOString(), attempts: 0 };
}

async function withStore<T>(fn: (s: import('@fonderie/store').IStoreAdapter) => Promise<T>): Promise<T> {
	const { PGAdapter } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	try {
		return await fn(store);
	} finally {
		await store.end();
	}
}

async function prepareDb(): Promise<void> {
	const { InternalMigrationRunner } = await import('@fonderie/store');
	await withStore((s) => new InternalMigrationRunner(s, getMigrationsPath()).run());
}

async function cleanup(): Promise<void> {
	await withStore(async (s) => {
		await s.query(
			`DELETE FROM fonderie_event_consumers WHERE event_id IN (SELECT id FROM fonderie_events WHERE type LIKE $1)`,
			[`${RUN}%`],
		);
		await s.query(`DELETE FROM fonderie_events WHERE type LIKE $1`, [`${RUN}%`]);
	});
}

async function row(eventId: string, consumer: string) {
	const [r] = await withStore((s) =>
		s.query<{ status: string; attempts: number; error: string | null }>(
			`SELECT status, attempts, error FROM fonderie_event_consumers WHERE event_id = $1 AND consumer = $2`,
			[eventId, consumer],
		),
	);
	return r;
}

// Publishes one event owed to `consumer`, then forces its delivery row into
// `state` — the shapes production was found holding.
async function seed(consumer: string, state: string): Promise<string> {
	const publisher = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	publisher.subscribe(consumer, async () => {}, consumer);
	await publisher.start();
	const m = meta(consumer);
	try {
		await publisher.publish(consumer, { n: 1 }, m);
	} finally {
		await publisher.stop();
	}
	await withStore((s) =>
		s.query(`UPDATE fonderie_event_consumers SET ${state} WHERE event_id = $1 AND consumer = $2`, [m.id, consumer]),
	);
	return m.id;
}

async function drainWith(consumer: string, opts: { claimTimeoutMs?: number } = {}) {
	const delivered: unknown[] = [];
	const t = new PGTransport({ connectionUrl: PG_URL!, consume: false, maxRetries: 3, ...opts });
	t.subscribe(consumer, async (p) => { delivered.push(p); }, consumer);
	await t.start();
	try {
		await t.drain({ maxMs: 5_000 });
	} finally {
		await t.stop();
	}
	return delivered;
}

test('a row reset to failed after its last attempt is buried as dead, not stranded', { skip }, async () => {
	await prepareDb();
	const consumer = `${RUN}-failed`;
	try {
		// What an older release's blanket reset left behind: failed, no error,
		// attempts spent.
		const id = await seed(consumer, `status = 'failed', attempts = 3, error = NULL`);
		const delivered = await drainWith(consumer);

		assert.equal(delivered.length, 0, 'spent attempts are not retried');
		const r = await row(id, consumer);
		assert.equal(r?.status, 'dead');
		assert.match(r?.error ?? '', /no attempt completed within 3 tries/);
	} finally {
		await cleanup();
	}
});

test('a row abandoned on its LAST attempt is buried once its lease expires — not before', { skip }, async () => {
	await prepareDb();
	const consumer = `${RUN}-abandoned`;
	try {
		const id = await seed(consumer, `status = 'processing', attempts = 3, claimed_at = now()`);

		// Inside the lease another instance may still be sending: hands off.
		await drainWith(consumer, { claimTimeoutMs: 600_000 });
		assert.equal((await row(id, consumer))?.status, 'processing');

		// Lease expired: nobody will ever finish it.
		await drainWith(consumer, { claimTimeoutMs: 0 });
		assert.equal((await row(id, consumer))?.status, 'dead');
	} finally {
		await cleanup();
	}
});

test('a failed row with attempts left is still retried (burying does not steal live work)', { skip }, async () => {
	await prepareDb();
	const consumer = `${RUN}-live`;
	try {
		const id = await seed(consumer, `status = 'failed', attempts = 1, error = 'smtp timeout'`);
		const delivered = await drainWith(consumer);
		assert.equal(delivered.length, 1);
		assert.equal((await row(id, consumer))?.status, 'processed');
	} finally {
		await cleanup();
	}
});

test('retryDead gives a dead row a full set of attempts; dismissDead retires it for good', { skip }, async () => {
	await prepareDb();
	const consumer = `${RUN}-ops`;
	const t = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	await t.start();
	try {
		const a = await seed(consumer, `status = 'dead', attempts = 3, error = 'template missing'`);
		const b = await seed(consumer, `status = 'dead', attempts = 3, error = 'code expired'`);
		const listed = () => t.deadLetters(50).then((d) => d.filter((x) => x.consumer === consumer).map((x) => x.eventId));
		assert.deepEqual((await listed()).sort(), [a, b].sort());

		assert.equal(await t.retryDead(a, consumer), true);
		assert.deepEqual(await row(a, consumer), { status: 'pending', attempts: 0, error: null });

		assert.equal(await t.dismissDead(b, consumer), true);
		const rb = await row(b, consumer);
		assert.equal(rb?.status, 'dismissed');
		assert.equal(rb?.error, 'code expired', 'the record of why it died is kept');

		assert.deepEqual(await listed(), [], 'neither is on the dead-letter list any more');
		// Only DEAD rows are touched: a second call finds nothing.
		assert.equal(await t.retryDead(a, consumer), false);
		assert.equal(await t.dismissDead(b, consumer), false);

		const delivered = await drainWith(consumer);
		assert.equal(delivered.length, 1, 'the retried row is delivered; the dismissed one never');
		assert.equal((await row(a, consumer))?.status, 'processed');
		assert.equal((await row(b, consumer))?.status, 'dismissed');
	} finally {
		await t.stop();
		await cleanup();
	}
});

test('integrity: rows signed before a key rotation verify under the retired key; a real edit is still tampered', { skip }, async () => {
	await prepareDb();
	const OLD = 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111';
	const NEW = 'bbbb-cccc-dddd-eeee-ffff-0000-1111-2222';
	const type = `${RUN}-sig`;
	try {
		const ids = await withStore(async (s) => {
			const out: string[] = [];
			for (const [key, n] of [[OLD, 1], [OLD, 2], [NEW, 3]] as const) {
				const m = meta(type);
				const payload = { n };
				await s.query(
					`INSERT INTO fonderie_events (id, type, payload, meta, hmac) VALUES ($1, $2, $3, $4, $5)`,
					[m.id, type, JSON.stringify(payload), JSON.stringify(m), computeEventHmac(key, { id: m.id, type, payload, meta: m })],
				);
				out.push(m.id);
			}
			return out;
		});

		const scoped = async (retired: string[]) => {
			const r = await withStore((s) => verifyEventChain(s, NEW, retired));
			return { ...r, tampered: r.tampered.filter((id) => ids.includes(id)) };
		};

		// Without the retired key, the pre-rotation rows read as tampered —
		// what production reported after its rotation.
		assert.deepEqual((await scoped([])).tampered.sort(), [ids[0], ids[1]].sort());

		const after = await scoped([OLD]);
		assert.deepEqual(after.tampered, []);
		assert.ok(after.retiredKey >= 2);

		// A retired key must not launder a real edit.
		await withStore((s) => s.query(`UPDATE fonderie_events SET payload = '{"n": 99}' WHERE id = $1`, [ids[0]]));
		assert.deepEqual((await scoped([OLD])).tampered, [ids[0]]);
	} finally {
		await cleanup();
	}
});

test('admin routes: list, retry and dismiss a dead delivery; refuse what is not dead', { skip }, async () => {
	await prepareDb();
	const { EventsModule } = await import('../module');
	const consumer = `${RUN}-admin`;
	const t = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	await t.start();
	try {
		const routes = new EventsModule({ transport: t }).describeAdmin().routes ?? [];
		const route = (method: string, suffix: string) => {
			const r = routes.find((x) => x.method === method && x.path.endsWith(suffix));
			assert.ok(r, `${method} …${suffix} is declared`);
			return r.handlers[0]!;
		};
		const call = async (h: ReturnType<typeof route>, params: Record<string, string> = {}) => {
			const ctx = { request: new Request('http://localhost/_admin/events/dead?limit=200'), meta: { params }, user: null, workspace: null, tenant: null };
			const res = await h(ctx as never, async () => new Response());
			return { status: res.status, body: (await res.json()) as { reason: string; result?: { deadLetters?: Array<{ eventId: string }> } } };
		};

		const id = await seed(consumer, `status = 'dead', attempts = 3, error = 'code expired'`);
		const list = await call(route('GET', '/events/dead'));
		assert.equal(list.status, 200);
		assert.ok(list.body.result?.deadLetters?.some((d) => d.eventId === id));

		const dismiss = route('POST', '/dismiss');
		assert.equal((await call(dismiss, { eventId: 'not-a-uuid', consumer })).status, 422);
		assert.equal((await call(dismiss, { eventId: id, consumer: encodeURIComponent(consumer) })).body.reason, 'DEAD_LETTER_DISMISSED');
		const again = await call(dismiss, { eventId: id, consumer });
		assert.equal(again.status, 404);
		assert.equal(again.body.reason, 'DEAD_LETTER_NOT_FOUND');
		assert.equal((await call(route('POST', '/retry'), { eventId: id, consumer })).status, 404, 'a dismissed row cannot be retried');
	} finally {
		await t.stop();
		await cleanup();
	}
});

test('publishing is all-or-nothing: if a consumer row cannot be written, the event is not stored either', { skip }, async () => {
	const consumer = `atomic-${randomUUID().slice(0, 8)}`;
	// Make ONLY this consumer's pending row fail to insert.
	await withStore((s) => s.query(`
		CREATE OR REPLACE FUNCTION fonderie_test_refuse_consumer() RETURNS trigger AS $$
		BEGIN
		  IF NEW.consumer = '${consumer}' THEN RAISE EXCEPTION 'refused for the test'; END IF;
		  RETURN NEW;
		END $$ LANGUAGE plpgsql;
		DROP TRIGGER IF EXISTS fonderie_test_refuse_consumer ON fonderie_event_consumers;
		CREATE TRIGGER fonderie_test_refuse_consumer BEFORE INSERT ON fonderie_event_consumers
		  FOR EACH ROW EXECUTE FUNCTION fonderie_test_refuse_consumer();`));
	const publisher = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	publisher.subscribe(consumer, async () => {}, consumer);
	await publisher.start();
	const m = meta(consumer);
	try {
		await assert.rejects(publisher.publish(consumer, { n: 1 }, m), /refused for the test/);
	} finally {
		await publisher.stop();
		await withStore((s) => s.query(`DROP TRIGGER IF EXISTS fonderie_test_refuse_consumer ON fonderie_event_consumers`));
	}
	const [stored] = await withStore((s) => s.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM fonderie_events WHERE id = $1`, [m.id]));
	assert.equal(stored!.n, 0, 'no orphan event without its delivery rows');
});
