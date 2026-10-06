import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { Dispatcher } from '../dispatcher';
import { getMigrationsPath } from '../migrations';
import type { ITemplateResolver } from '../types';

// The message log after a successful send, on a REAL Postgres, when the
// connection drops after the send. The provider id and the 'sent' status are
// one fact — "this message went out, as provider message X" — so they land in
// one statement. As two, the first could land without the second: a row
// 'pending' that already carries a provider id, i.e. a message that went out
// recorded as one that never did (and a candidate for sending again).
//
//   COURIER_PG_URL=postgres://... npm test -w @fonderie/courier

const PG_URL = process.env['COURIER_PG_URL'];
const skip = PG_URL ? false : 'set COURIER_PG_URL to run';
const TYPE = 'pg-sent-log-test';

let store: IStoreAdapter & { end?: () => Promise<void> };

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query('DELETE FROM fonderie_message_log WHERE message_type = $1', [TYPE]);
});

after(async () => {
	if (!PG_URL) return;
	await store.query('DELETE FROM fonderie_message_log WHERE message_type = $1', [TYPE]);
	await store.end?.();
});

const resolver: ITemplateResolver = {
	async resolve() {
		return { subject: 'Hello', text: 'Hello' };
	},
};

// After the provider accepted the message, the `n`th write to the log fails.
function dropsWriteAfterSend(inner: IStoreAdapter, n: number, sent: { done: boolean }) {
	let writes = 0;
	const wrap = (s: IStoreAdapter): IStoreAdapter => ({
		async query<T>(sql: string, params?: unknown[]) {
			if (sent.done && /UPDATE fonderie_message_log/.test(sql) && ++writes === n)
				throw new Error('connection lost');
			return s.query<T>(sql, params);
		},
		transaction: (fn) => s.transaction((tx) => fn(wrap(tx))),
	});
	return wrap(inner);
}

async function send(s: IStoreAdapter, providerMessageId: string, sent: { done: boolean }) {
	const dispatcher = new Dispatcher(
		{ channels: { [TYPE]: ['email'] }, recipientLocaleLookup: false } as never,
		resolver,
		s,
	);
	dispatcher.registerChannel({
		name: 'email',
		send: async () => {
			sent.done = true;
			return { providerMessageId };
		},
	});
	await dispatcher.dispatch({
		type: TYPE,
		recipient: { email: 'someone@acme.example', phone: null, deviceToken: null },
		data: {},
	});
}

const logRow = async (providerMessageId: string) =>
	(
		await store.query<{ status: string; provider_message_id: string | null }>(
			`SELECT status, provider_message_id FROM fonderie_message_log
			 WHERE message_type = $1 AND (provider_message_id = $2 OR provider_message_id IS NULL)
			 ORDER BY created_at DESC LIMIT 1`,
			[TYPE, providerMessageId],
		)
	)[0];

test('the write after the send fails: never a pending row that already carries a provider id', {
	skip,
}, async () => {
	await store.query('DELETE FROM fonderie_message_log WHERE message_type = $1', [TYPE]);
	const sent = { done: false };
	await send(dropsWriteAfterSend(store, 2, sent), 'prov-b9-1', sent);
	assert.ok(sent.done, 'the provider accepted the message');
	const r = await logRow('prov-b9-1');
	assert.ok(r, 'the log row exists');
	assert.ok(
		!(r.status === 'pending' && r.provider_message_id !== null),
		`left '${r.status}' with provider id ${r.provider_message_id}`,
	);
});

test('the healthy path: sent, with the provider id, in one write', { skip }, async () => {
	await store.query('DELETE FROM fonderie_message_log WHERE message_type = $1', [TYPE]);
	const sent = { done: false };
	await send(store, 'prov-b9-2', sent);
	const r = await logRow('prov-b9-2');
	assert.deepEqual(
		{ status: r?.status, id: r?.provider_message_id },
		{ status: 'sent', id: 'prov-b9-2' },
	);
});
