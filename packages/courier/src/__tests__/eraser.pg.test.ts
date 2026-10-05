import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { accountEraser, erasureEmailKey } from '../eraser';
import { getMigrationsPath } from '../migrations';

// The account-deletion eraser against the REAL message log: the person's rows
// are redacted (not deleted — delivery statistics stay), everyone else's are
// untouched, and a second run changes nothing.
//
//   COURIER_PG_URL=postgres://... npm test -w @fonderie/courier
//
// CI runs every PG suite against ONE database at once: every row here carries a
// message type unique to this run, and only those rows are read or deleted.

const PG_URL = process.env['COURIER_PG_URL'];
const skip = PG_URL ? false : 'set COURIER_PG_URL to run';
const RUN = randomUUID().slice(0, 8);
const TYPE = `erase-test-${RUN}`;
const DOMAIN = `erase-${RUN}.acme.example`;
const ANA = `ana@${DOMAIN}`;
const ANA_PHONE = `+1555${RUN.replace(/\D/g, '').padEnd(7, '7').slice(0, 7)}`;
const BEN = `ben@${DOMAIN}`;

let store: IStoreAdapter & { end?: () => Promise<void> };

interface LogRow {
	id: string;
	recipient: string;
	channel: string;
	status: string;
	error: string | null;
	bounce_reason: string | null;
	provider_message_id: string | null;
}

async function log(
	recipient: string,
	extra: { channel?: string; status?: string; error?: string; bounce?: string } = {},
): Promise<string> {
	const [row] = await store.query<{ id: string }>(
		`INSERT INTO fonderie_message_log
		   (message_type, channel, recipient, status, error, bounce_reason, provider_message_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		[
			TYPE,
			extra.channel ?? 'email',
			recipient,
			extra.status ?? 'sent',
			extra.error ?? null,
			extra.bounce ?? null,
			`prov-${randomUUID()}`,
		],
	);
	return row!.id;
}

async function rows(): Promise<Map<string, LogRow>> {
	const all = await store.query<LogRow>(
		`SELECT id, recipient, channel, status, error, bounce_reason, provider_message_id
		   FROM fonderie_message_log WHERE message_type = $1`,
		[TYPE],
	);
	return new Map(all.map((r) => [r.id, r]));
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
});

after(async () => {
	if (!store) return;
	await store.query(`DELETE FROM fonderie_message_log WHERE message_type = $1`, [TYPE]);
	await store.end?.();
});

test('the email key is the account rule: lowercase, +tag dropped', () => {
	assert.equal(erasureEmailKey(' Ana+News@Acme.Example '), 'ana@acme.example');
	assert.equal(erasureEmailKey('ana@acme.example'), 'ana@acme.example');
	assert.equal(erasureEmailKey('+tag@acme.example'), null);
	assert.equal(erasureEmailKey('not-an-address'), null);
});

test('the person’s rows are redacted, kept, and nobody else’s change', { skip }, async () => {
	const exact = await log(ANA, { status: 'delivered' });
	const cased = await log(ANA.toUpperCase());
	const tagged = await log(`ana+receipts@${DOMAIN}`);
	const named = await log(`Ana Example <Ana+x@${DOMAIN}>`);
	const bounced = await log(ANA, {
		status: 'bounced',
		error: `550 5.1.1 <${ANA}>: mailbox unavailable`,
		bounce: `${ANA} does not exist`,
	});
	const sms = await log(ANA_PHONE, { channel: 'sms' });
	const smsTyped = await log(`${ANA_PHONE.slice(0, 2)} (${ANA_PHONE.slice(2, 5)}) ${ANA_PHONE.slice(5, 8)}-${ANA_PHONE.slice(8)}`, {
		channel: 'sms',
	});
	// Not the person: another address at the same domain, an address that merely
	// CONTAINS hers, a different local part sharing her prefix, and a push token.
	const other = await log(BEN, { status: 'failed', error: `550 <${BEN}> unknown` });
	const lookalike = await log(`xana@${DOMAIN}`);
	const prefix = await log(`ana.b@${DOMAIN}`);
	const longer = await log(`ana@${DOMAIN}.evil.example`);
	const otherPhone = await log(`${ANA_PHONE}9`, { channel: 'sms' });
	const push = await log(`device-token-${RUN}`, { channel: 'push' });

	const before = await rows();
	const eraser = accountEraser(store);
	assert.equal(eraser.name, 'courier');
	const res = await eraser.erase({ userId: randomUUID(), email: ANA, phone: ANA_PHONE });

	const mine = [exact, cased, tagged, named, bounced, sms, smsTyped];
	assert.equal(res.erased, mine.length);
	assert.match(res.kept ?? '', /kept with the recipient/);

	const now = await rows();
	for (const id of mine) {
		const r = now.get(id)!;
		const was = before.get(id)!;
		assert.equal(r.recipient, 'erased', `${was.recipient} redacted`);
		// Delivery statistics survive.
		assert.equal(r.status, was.status);
		assert.equal(r.channel, was.channel);
		assert.equal(r.provider_message_id, was.provider_message_id);
	}
	assert.equal(now.get(bounced)!.error, 'erased', 'a provider error quoting the address is redacted');
	assert.equal(now.get(bounced)!.bounce_reason, 'erased');
	assert.equal(now.get(exact)!.error, null, 'an absent error stays absent');

	for (const id of [other, lookalike, prefix, longer, otherPhone, push]) {
		assert.deepEqual(now.get(id), before.get(id), `${before.get(id)!.recipient} untouched`);
	}

	// Idempotent.
	const again = await eraser.erase({ userId: randomUUID(), email: ANA, phone: ANA_PHONE });
	assert.deepEqual(again, { erased: 0 });
	assert.deepEqual(await rows(), now);
});

test('no email and no phone: nothing to match, nothing touched', { skip }, async () => {
	const res = await accountEraser(store).erase({ userId: randomUUID(), email: null, phone: null });
	assert.deepEqual(res, { erased: 0 });
});
