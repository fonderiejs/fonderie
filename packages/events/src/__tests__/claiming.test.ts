import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PGTransport } from '../transports/pg';
import { getMigrationsPath } from '../migrations';

/**
 * Does exclusive claiming actually hold when two instances drain at once?
 *
 * This cannot be answered by a mocked store. `FOR UPDATE ... SKIP LOCKED` and
 * the visibility lease are behaviours of Postgres, not of our code — a stub
 * returns whatever rows it is told to and will happily "prove" an invariant
 * that the real database does not provide. The failure it guards against is
 * also invisible in a single-threaded test: the queue looks perfectly healthy
 * while every subscriber runs twice, so users get two of each email.
 *
 * Both scenarios below were real bugs. `drain()` used to blanket-reset rows
 * stuck in `processing`, which hands a second worker a row the first is still
 * sending; and there was no lease at all, so a row whose instance died
 * mid-send stayed `processing` forever and was never retried.
 *
 *   EVENTS_PG_URL=postgres://... npm test -w @fonderie/events
 */
const PG_URL = process.env['EVENTS_PG_URL'];
const skip = PG_URL ? false : 'set EVENTS_PG_URL to run';

// Unique per run so concurrent runs (and leftovers from a failed one) cannot
// see each other's rows.
const RUN = `claimtest-${process.pid}-${Math.floor(process.uptime() * 1000)}`;

// Same shape rate-limit's integration test uses: bring the schema up before
// touching it, so the test works against an empty database.
// PGTransport.publish writes meta verbatim, so it needs a real one — the
// EventBus normally supplies this.
function meta(type: string) {
	return {
		// fonderie_events.id is a uuid column.
		id: randomUUID(),
		type,
		emittedAt: new Date().toISOString(),
		attempts: 0,
	};
}

// These tests write real rows. Remove them so a dev database is not slowly
// filled with queue debris (and so a later run's counts are not polluted).
async function cleanup(): Promise<void> {
	const { PGAdapter } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	try {
		await store.query(
			`DELETE FROM fonderie_event_consumers
			  WHERE event_id IN (SELECT id FROM fonderie_events WHERE type LIKE $1)`,
			[`${RUN}%`],
		);
		await store.query(`DELETE FROM fonderie_events WHERE type LIKE $1`, [`${RUN}%`]);
	} finally {
		await store.end();
	}
}

async function prepareDb(): Promise<void> {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.end();
}

test('concurrent drains never deliver the same event twice', { skip }, async () => {
	await prepareDb();

	const EVENTS = 25;
	const DRAINERS = 4;

	// Each transport is a separate "instance" — the thing a second serverless
	// container or a second worker would be.
	const transports = Array.from(
		{ length: DRAINERS },
		() => new PGTransport({ connectionUrl: PG_URL!, consume: false }),
	);
	const publisher = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	// The publisher must declare the same consumer the workers do. publish()
	// writes one fonderie_event_consumers row per consumer THIS transport knows
	// about, so a publisher that has not registered the channel writes an event
	// owed to nobody — see the drift test at the bottom of this file. Its handler
	// is never invoked here; only the registration matters.
	publisher.subscribe(RUN, async () => {}, RUN);

	const delivered: string[] = [];
	for (const t of transports) {
		t.subscribe(
			RUN,
			async (payload) => {
				// A real send takes time; that window is exactly where a second
				// claimer would slip in.
				await new Promise((r) => setTimeout(r, 15));
				delivered.push((payload as { n: string }).n);
			},
			RUN,
		);
	}

	// start() is what creates the connection pool; publish/drain before it
	// dereference an undefined store.
	await Promise.all([...transports, publisher].map((t) => t.start()));

	try {
		for (let i = 0; i < EVENTS; i++) {
			await publisher.publish(RUN, { n: `e${i}` }, meta(RUN));
		}

		// All drains at once, which is the only configuration that can expose a
		// claiming bug.
		await Promise.all(transports.map((t) => t.drain({ maxMs: 20_000 })));

		const unique = new Set(delivered);
		const duplicated = [...unique].filter(
			(n) => delivered.filter((d) => d === n).length > 1,
		);

		assert.deepEqual(duplicated, [], `these events were delivered more than once: ${duplicated}`);
		assert.equal(
			delivered.length,
			EVENTS,
			'every published event must be delivered exactly once — a short count means rows were ' +
				'claimed and then dropped, which is worse than a duplicate',
		);
	} finally {
		await Promise.all([...transports, publisher].map((t) => t.stop()));
		await cleanup();
	}
});

test('a row abandoned mid-send is reclaimed, but only after its lease expires', { skip }, async () => {
	/**
	 * The case the lease exists for: an instance claims a row and then DIES —
	 * frozen by the platform, killed mid-send — without ever marking it failed.
	 * The row is left `processing` with nobody working it.
	 *
	 * Simulated with a handler that hangs rather than one that throws. A throwing
	 * handler marks the row `failed`, which drain() is entitled to retry
	 * immediately (up to maxRetries) within the same pass — that is retry
	 * behaviour, not abandonment.
	 *
	 * Two things must both hold, and they pull in opposite directions:
	 *   • inside the lease the row must NOT be reclaimed, or a second instance
	 *     re-sends what the first is still sending (the blanket-reset bug)
	 *   • once the lease expires it MUST be reclaimed, or a row whose instance
	 *     died is stranded in `processing` forever and never retried
	 */
	await prepareDb();

	const consumer = `${RUN}-lease`;
	let release: (() => void) | undefined;
	const hang = new Promise<void>((r) => { release = r; });

	// Claims the row, then never finishes — the row stays `processing`.
	const stalling = new PGTransport({
		connectionUrl: PG_URL!,
		consume: false,
		claimTimeoutMs: 600_000,
	});
	// Same long lease: must refuse to touch a row another instance holds.
	const patient = new PGTransport({
		connectionUrl: PG_URL!,
		consume: false,
		claimTimeoutMs: 600_000,
	});
	// Zero lease: every `processing` row counts as abandoned.
	const impatient = new PGTransport({
		connectionUrl: PG_URL!,
		consume: false,
		claimTimeoutMs: 0,
	});
	const publisher = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	publisher.subscribe(consumer, async () => {}, consumer);

	let claimedByStalling = 0;
	stalling.subscribe(consumer, async () => { claimedByStalling++; await hang; }, consumer);

	let reclaimed = 0;
	const count = async () => { reclaimed++; };
	patient.subscribe(consumer, count, consumer);
	impatient.subscribe(consumer, count, consumer);

	const all = [stalling, patient, impatient, publisher];
	await Promise.all(all.map((t) => t.start()));

	try {
		await publisher.publish(consumer, { n: 'stuck' }, meta(consumer));

		// Abandon it: claim, hang, and let drain hit its own deadline. Not awaited
		// to completion — that is the point, the work never finishes.
		const abandoned = stalling.drain({ maxMs: 1_000 });
		await new Promise((r) => setTimeout(r, 400));
		assert.equal(claimedByStalling, 1, 'the row was claimed and is now mid-flight');

		await patient.drain({ maxMs: 2_000 });
		assert.equal(
			reclaimed,
			0,
			'a row inside its lease must not be reclaimed — reclaiming it is what sends the ' +
				'same email twice',
		);

		await impatient.drain({ maxMs: 5_000 });
		assert.equal(
			reclaimed,
			1,
			'once the lease expires the row must be reclaimed, not stranded in processing forever',
		);

		release?.();
		await abandoned.catch(() => {});
	} finally {
		release?.();
		await Promise.all(all.map((t) => t.stop()));
		await cleanup();
	}
});

test('an event published with no matching consumer is owed to nobody', { skip }, async () => {
	/**
	 * The quietest failure in the whole system, and the reason both processes in
	 * an app must build their channel list from ONE function.
	 *
	 * publish() writes one fonderie_event_consumers row per consumer the
	 * PUBLISHING transport has registered. A publisher that never registered the
	 * channel writes the event row and nothing else — so the worker polls for
	 * consumer rows, finds none, and the message is not queued, not retried, not
	 * dead-lettered. It is simply absent. Every health metric reads clean:
	 * `pending` is 0 because nothing was ever owed, and `dead` is 0 because
	 * nothing ever failed.
	 *
	 * This pins the behaviour down so it is a known property rather than a
	 * surprise discovered in production.
	 */
	await prepareDb();
	const channel = `${RUN}-orphan`;

	const publisher = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	const worker = new PGTransport({ connectionUrl: PG_URL!, consume: false });
	let received = 0;
	worker.subscribe(channel, async () => { received++; }, channel);

	await Promise.all([publisher, worker].map((t) => t.start()));
	try {
		// Publisher has NOT subscribed to `channel`.
		await publisher.publish(channel, { n: 'orphan' }, meta(channel));
		await worker.drain({ maxMs: 5_000 });

		assert.equal(received, 0, 'nothing is delivered — the consumer row was never written');

		const { PGAdapter } = await import('@fonderie/store');
		const store = new PGAdapter(PG_URL!);
		try {
			const owed = await store.query<{ n: string }>(
				`SELECT count(*)::text AS n FROM fonderie_event_consumers c
				   JOIN fonderie_events e ON e.id = c.event_id
				  WHERE e.type = $1`,
				[channel],
			);
			assert.equal(owed[0]?.n, '0', 'no consumer row exists, so no retry machinery can ever see it');

			const stored = await store.query<{ n: string }>(
				`SELECT count(*)::text AS n FROM fonderie_events WHERE type = $1`,
				[channel],
			);
			assert.equal(
				stored[0]?.n,
				'1',
				'the event itself IS durably stored — the loss is the owing, not the record, ' +
					'which is what makes it recoverable once the channel lists agree',
			);
		} finally {
			await store.end();
		}
	} finally {
		await Promise.all([publisher, worker].map((t) => t.stop()));
		await cleanup();
	}
});
