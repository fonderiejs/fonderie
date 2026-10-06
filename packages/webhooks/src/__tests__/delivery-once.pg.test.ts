import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import type { IEventMeta } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import { WebhookDispatcher } from '../dispatcher';
import { getMigrationsPath } from '../migrations';
import { DeliveryModel } from '../models/delivery.model';
import type { WebhookTransport } from '../ssrf';

/**
 * A webhook goes out once per event and endpoint, and is never silently lost —
 * against a REAL Postgres, because both halves are properties of the database
 * (a unique index, a row lock), not of our code.
 *
 * The events outbox is at-least-once: a dispatch that did not finish is run
 * again. Three things went wrong around that:
 *   • every re-dispatch inserted a second delivery row and POSTed the same
 *     event to the customer's endpoint again
 *   • a row inserted 'pending' whose process died before the first attempt was
 *     never retried — the retry loop only looked at 'failed' rows
 *   • a delivery row that could not be written was swallowed, the event was
 *     marked processed, and the webhook was gone with nothing to retry it
 *
 *   WEBHOOKS_PG_URL=postgres://... npm test -w @fonderie/webhooks
 *
 * CI runs every PG suite against ONE database at once: every row here hangs off
 * an endpoint this run created, and the retry pass is fenced off from anyone
 * else's due rows (see withOthersLocked).
 */
const PG_URL = process.env['WEBHOOKS_PG_URL'];
const skip = PG_URL ? false : 'set WEBHOOKS_PG_URL to run';
const RUN = randomUUID().slice(0, 8);
const HOOK_URL = `https://once-${RUN}.acme.example/in`;

let store: IStoreAdapter & { end: () => Promise<void> };
let endpointId = '';
let workspaceId = '';

function meta(): IEventMeta {
	return { id: randomUUID(), type: 'project.created', emittedAt: new Date().toISOString(), attempts: 0 };
}

// Records every POST and answers 200. No DNS, no sockets.
function recorder(): WebhookTransport & { sent: string[] } {
	const sent: string[] = [];
	const fn = (async (_url, init) => {
		sent.push(JSON.parse(init.body).id as string);
		return { ok: true, status: 200, body: '' };
	}) as WebhookTransport & { sent: string[] };
	fn.sent = sent;
	return fn;
}

async function rowsFor(eventId: string) {
	return store.query<{ id: string; status: string; attempts: number }>(
		`SELECT id, status, attempts FROM fonderie_webhook_deliveries
		  WHERE endpoint_id = $1 AND event_id = $2`,
		[endpointId, eventId],
	);
}

/**
 * claimForRetry is global — it takes any due row in the table. In a shared
 * database that includes other suites' rows, so hold a row lock on every due
 * row that is NOT ours for the duration: the claim's SKIP LOCKED passes over
 * them, and nobody else's delivery is sent or touched by this test.
 */
async function withOthersLocked(fn: () => Promise<void>): Promise<void> {
	await store.transaction(async (tx) => {
		await tx.query(
			`SELECT id FROM fonderie_webhook_deliveries
			  WHERE endpoint_id <> $1 AND status IN ('pending', 'failed')
			  FOR UPDATE`,
			[endpointId],
		);
		await fn();
	});
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	workspaceId = randomUUID();
	const [ep] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_webhook_endpoints (workspace_id, url, secret, events)
		 VALUES ($1, $2, 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111', '{}') RETURNING id`,
		[workspaceId, HOOK_URL],
	);
	endpointId = ep!.id;
});

after(async () => {
	if (!store) return;
	// Deliveries go with the endpoint (ON DELETE CASCADE).
	await store.query(`DELETE FROM fonderie_webhook_endpoints WHERE id = $1`, [endpointId]);
	await store.end();
});

test('a re-dispatched event is sent once, not once per dispatch', { skip }, async () => {
	const transport = recorder();
	const dispatcher = new WebhookDispatcher(store, {}, transport);

	// The outbox reclaiming a consumer row whose first dispatch did not get as
	// far as being marked processed: the same event, dispatched again.
	const again = meta();
	await dispatcher.dispatch({ workspaceId }, again);
	await dispatcher.dispatch({ workspaceId }, again);

	// Two workers reclaiming it at the same moment.
	const racing = meta();
	await Promise.all([
		dispatcher.dispatch({ workspaceId }, racing),
		dispatcher.dispatch({ workspaceId }, racing),
	]);

	assert.deepEqual(
		transport.sent.filter((id) => id === again.id),
		[again.id],
		'the customer endpoint received the same event more than once',
	);
	assert.deepEqual(transport.sent.filter((id) => id === racing.id), [racing.id]);
	assert.equal((await rowsFor(again.id)).length, 1, 'one delivery row per event and endpoint');
	assert.equal((await rowsFor(racing.id)).length, 1);
});

test('a delivery whose first attempt was never recorded is retried once its lease lapses', { skip }, async () => {
	const transport = recorder();
	const dispatcher = new WebhookDispatcher(store, {}, transport);
	const deliveries = new DeliveryModel(store);

	// What a process leaves behind when it dies between inserting the row and
	// marking the result: 'pending', no next_attempt_at.
	const fresh = meta();
	const stale = meta();
	for (const m of [fresh, stale]) {
		await deliveries.create({ endpointId, eventId: m.id, eventType: m.type, payload: { workspaceId } });
	}
	// Older than the lease, so its dispatch is certainly gone.
	await store.query(
		`UPDATE fonderie_webhook_deliveries SET created_at = now() - interval '10 minutes'
		  WHERE endpoint_id = $1 AND event_id = $2`,
		[endpointId, stale.id],
	);

	// Two retry passes at once, as two warm instances would run them.
	await withOthersLocked(async () => {
		await Promise.all([dispatcher.retry(), dispatcher.retry()]);
	});

	assert.deepEqual(
		transport.sent.filter((id) => id === stale.id),
		[stale.id],
		'an abandoned pending delivery must be sent — once — by the retry loop',
	);
	assert.equal((await rowsFor(stale.id))[0]?.status, 'delivered');
	assert.deepEqual(
		transport.sent.filter((id) => id === fresh.id),
		[],
		'a pending row inside its lease may still be mid-send by the dispatch that made it',
	);
	assert.equal((await rowsFor(fresh.id))[0]?.status, 'pending');
});

test('a delivery row that cannot be written fails the dispatch, so the outbox retries it', { skip }, async () => {
	const transport = recorder();
	// The real store, except the delivery INSERT fails once — a dropped
	// connection at exactly the wrong moment.
	let failNext = true;
	const flaky = {
		query: async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (failNext && sql.includes('INSERT INTO fonderie_webhook_deliveries')) {
				failNext = false;
				throw new Error('connection terminated unexpectedly');
			}
			return store.query<T>(sql, params);
		},
		transaction: store.transaction.bind(store),
	} as IStoreAdapter;

	const m = meta();
	await assert.rejects(
		new WebhookDispatcher(flaky, {}, transport).dispatch({ workspaceId }, m),
		'a swallowed failure marks the event processed and the webhook is lost for good',
	);
	assert.equal((await rowsFor(m.id)).length, 0);

	// The outbox runs it again.
	await new WebhookDispatcher(flaky, {}, transport).dispatch({ workspaceId }, m);
	assert.deepEqual(transport.sent, [m.id]);
	assert.equal((await rowsFor(m.id))[0]?.status, 'delivered');
});
