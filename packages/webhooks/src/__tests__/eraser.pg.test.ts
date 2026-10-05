import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { accountEraser } from '../eraser';
import { getMigrationsPath } from '../migrations';

/**
 * The account-deletion eraser against REAL delivery records: the person's
 * fields in payloads and echoed response bodies are redacted, the delivery
 * record itself is kept, nobody else's rows change, and a second run does
 * nothing.
 *
 *   WEBHOOKS_PG_URL=postgres://... npm test -w @fonderie/webhooks
 *
 * CI runs every PG suite against ONE database at once: rows hang off an
 * endpoint created for this run, and only those are read or deleted.
 */
const PG_URL = process.env['WEBHOOKS_PG_URL'];
const skip = PG_URL ? false : 'set WEBHOOKS_PG_URL to run';
const RUN = randomUUID().slice(0, 8);
const DOMAIN = `erase-${RUN}.acme.example`;
const DIGITS = `${Date.now()}`.slice(-7);
const PHONE = `+1555${DIGITS}`;

let store: IStoreAdapter & { end: () => Promise<void> };
let endpointId = '';

interface Row {
	id: string;
	event_id: string;
	event_type: string;
	payload: Record<string, unknown>;
	status: string;
	attempts: number;
	response_status: number | null;
	response_body: string | null;
}

async function deliver(payload: Record<string, unknown>, responseBody: string | null = null): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_webhook_deliveries
		   (endpoint_id, event_id, event_type, payload, status, attempts, response_status, response_body)
		 VALUES ($1, $2, 'fonderie.test.event', $3, 'delivered', 1, 200, $4) RETURNING id`,
		[endpointId, randomUUID(), JSON.stringify(payload), responseBody],
	);
	return row!.id;
}

async function rows(): Promise<Map<string, Row>> {
	const all = await store.query<Row>(
		`SELECT id, event_id, event_type, payload, status, attempts, response_status, response_body
		   FROM fonderie_webhook_deliveries WHERE endpoint_id = $1`,
		[endpointId],
	);
	return new Map(all.map((r) => [r.id, r]));
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const [ep] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_webhook_endpoints (workspace_id, url, secret, events)
		 VALUES ($1, 'https://hooks.acme.example/in', 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111', '{}') RETURNING id`,
		[randomUUID()],
	);
	endpointId = ep!.id;
});

after(async () => {
	if (!store) return;
	await store.query(`DELETE FROM fonderie_webhook_endpoints WHERE id = $1`, [endpointId]); // cascades
	await store.end();
});

test('the person’s fields are redacted, the delivery record kept, others untouched, idempotent', { skip }, async () => {
	const userId = randomUUID();
	const workspaceId = randomUUID();
	const about = await deliver({ workspaceId, userId, email: `ana@${DOMAIN}`, firstName: 'Ana', lastName: 'Example', role: 'admin' });
	const mention = await deliver(
		{ workspaceId, customerId: randomUUID(), contact: { email: `Ana+CRM@${DOMAIN.toUpperCase()}`, phone: `+1 (555) ${DIGITS.slice(0, 3)}-${DIGITS.slice(3)}` }, tags: ['vip'] },
		`{"received":"ana@${DOMAIN}"}`,
	);
	const echoed = await deliver({ workspaceId, userId: randomUUID() }, `accepted; sms ${PHONE}`);
	const noPii = await deliver({ workspaceId, userId }); // about them, nothing personal

	const ben = await deliver({ workspaceId, userId: randomUUID(), email: `ben@${DOMAIN}`, firstName: 'Ben' }, `ok ben@${DOMAIN}`);
	const lookalike = await deliver({ workspaceId, contact: { email: `xana@${DOMAIN}`, phone: `${PHONE}9` } });
	const longer = await deliver({ workspaceId, email: `ana@${DOMAIN}.evil.example` }, `ana.b@${DOMAIN}`);

	const before = await rows();
	const eraser = accountEraser(store);
	assert.equal(eraser.name, 'webhooks');
	const res = await eraser.erase({ userId, email: `ana@${DOMAIN}`, phone: PHONE });

	const now = await rows();
	assert.deepEqual(now.get(about)!.payload, {
		workspaceId,
		userId,
		email: 'erased',
		firstName: 'erased',
		lastName: 'erased',
		role: 'admin',
	});
	assert.deepEqual(now.get(mention)!.payload, {
		...before.get(mention)!.payload,
		contact: { email: 'erased', phone: 'erased' },
	});
	assert.equal(now.get(mention)!.response_body, 'erased');
	assert.equal(now.get(echoed)!.response_body, 'erased', 'a body echoing their phone is redacted');
	assert.deepEqual(now.get(echoed)!.payload, before.get(echoed)!.payload);
	// The delivery record itself survives.
	for (const id of [about, mention, echoed]) {
		const { payload: _p, response_body: _b, ...record } = now.get(id)!;
		const { payload: _p0, response_body: _b0, ...was } = before.get(id)!;
		assert.deepEqual(record, was);
	}
	for (const id of [noPii, ben, lookalike, longer]) {
		assert.deepEqual(now.get(id), before.get(id), 'untouched');
	}
	assert.equal(res.erased, 3);
	assert.match(res.kept ?? '', /3 webhook delivery record/);

	const again = await eraser.erase({ userId, email: `ana@${DOMAIN}`, phone: PHONE });
	assert.deepEqual(again, { erased: 0 });
	assert.deepEqual(await rows(), now);
});
