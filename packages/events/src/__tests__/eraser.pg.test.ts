import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { accountEraser } from '../eraser';
import { computeEventHmac, verifyEventChain } from '../integrity';
import { getMigrationsPath } from '../migrations';

/**
 * The account-deletion eraser against the REAL event log: notifications to the
 * person are deleted, every other event naming them is redacted and RE-SIGNED
 * (the integrity check still reads it as intact), nobody else's rows change,
 * and a second run does nothing.
 *
 *   EVENTS_PG_URL=postgres://... npm test -w @fonderie/events
 *
 * CI runs every PG suite against ONE database at once: each test uses its own
 * user id and address domain, reads only the rows it wrote, and the integrity
 * report is scoped to those rows.
 */
const PG_URL = process.env['EVENTS_PG_URL'];
const skip = PG_URL ? false : 'set EVENTS_PG_URL to run';
const KEY = 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-eras';
const RETIRED = 'bbbb-cccc-dddd-eeee-ffff-0000-1111-eras';
const NOTIFY = 'fonderie.notification.send';

let store: IStoreAdapter & { end: () => Promise<void> };
const written: string[] = [];

interface Row {
	id: string;
	type: string;
	payload: Record<string, unknown>;
	meta: Record<string, unknown>;
	hmac: string | null;
}

function world() {
	const run = randomUUID().slice(0, 8);
	const domain = `erase-${run}.acme.example`;
	const digits = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-7);
	return {
		userId: randomUUID(),
		domain,
		email: `ana@${domain}`,
		oldEmail: `ana.old@${domain}`,
		midEmail: `ana.mid@${domain}`,
		phone: `+1555${digits}`,
		typed: `+1 (555) ${digits.slice(0, 3)}-${digits.slice(3)}`,
		custom: `erase-test-${run}`,
	};
}

/** Insert one event the way the PG transport does — signed with `key`, or unsigned. */
async function put(type: string, payload: Record<string, unknown>, key: string | null = KEY): Promise<string> {
	const id = randomUUID();
	const meta = { id, type, emittedAt: new Date().toISOString(), attempts: 0 };
	const hmac = key ? computeEventHmac(key, { id, type, payload, meta }) : null;
	await store.query(`INSERT INTO fonderie_events (id, type, payload, meta, hmac) VALUES ($1, $2, $3, $4, $5)`, [
		id,
		type,
		JSON.stringify(payload),
		JSON.stringify(meta),
		hmac,
	]);
	written.push(id);
	return id;
}

async function delivery(eventId: string, status: string): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_event_consumers (event_id, consumer, status, attempts) VALUES ($1, 'courier', $2, 1)`,
		[eventId, status],
	);
}

async function read(ids: string[]): Promise<Map<string, Row>> {
	const rows = await store.query<Row>(
		`SELECT id, type, payload, meta, hmac FROM fonderie_events WHERE id = ANY($1::uuid[])`,
		[ids],
	);
	return new Map(rows.map((r) => [r.id, r]));
}

async function tamperedAmong(ids: string[]): Promise<string[]> {
	const r = await verifyEventChain(store, KEY, [RETIRED]);
	return r.tampered.filter((id) => ids.includes(id));
}

const notice = (type: string, recipient: Record<string, unknown>, data: Record<string, unknown> = {}) => ({
	type,
	recipient: { email: null, phone: null, deviceToken: null, ...recipient },
	data,
});

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
});

after(async () => {
	if (!store) return;
	await store.query(`DELETE FROM fonderie_events WHERE id = ANY($1::uuid[])`, [written]);
	await store.end();
});

test('notifications deleted, other events redacted and re-signed, others untouched, idempotent', { skip }, async () => {
	const w = world();

	// ── the person's, in the order it happened: registered as `old`, moved to
	// `mid`, then to the current address. `mid` is known ONLY through the
	// email-changed notices (each sent to the previous address, naming the new).
	const registered = await put('fonderie.user.registered', {
		userId: w.userId,
		email: w.oldEmail,
		firstName: 'Ana',
		lastName: 'Example',
		loginMethod: 'email',
	});
	const welcome = await put(NOTIFY, notice('email-registration', { email: w.oldEmail }, { pin: '123456', firstName: 'Ana' }));
	const changed = await put(NOTIFY, notice('email-changed', { email: w.oldEmail }, { newEmail: w.midEmail }));
	const toMid = await put(NOTIFY, notice('email-verification', { email: w.midEmail }, { pin: '111111' }));
	const changedAgain = await put(NOTIFY, notice('email-changed', { email: w.midEmail }, { newEmail: w.email }));
	const reset = await put(
		NOTIFY,
		notice('password-reset', { email: `Ana+Shop@${w.domain.toUpperCase()}` }, { pin: '654321', token: 't', resetUrl: 'https://acme.example/r?t=t' }),
	);
	const otp = await put(NOTIFY, notice('phone-otp', { phone: w.typed }, { otp: '999999' }));
	await delivery(otp, 'processed');
	const dead = await put(NOTIFY, notice('mfa-enabled', { email: w.email }));
	await delivery(dead, 'dead');
	const revoked = await put('fonderie.session.revoked', { userId: w.userId, sids: null, reason: 'password-changed' });
	const mention = await put(w.custom, {
		workspaceId: randomUUID(),
		actor: { label: `Ana Example <ana+team@${w.domain}>`, phone: w.phone },
		count: 3,
	});
	const unsigned = await put(w.custom, { userId: w.userId, email: w.email, phone: w.phone }, null);
	const oldKey = await put(w.custom, { userId: w.userId, firstName: 'Ana' }, RETIRED);

	// ── not the person's ──
	const ben = await put(NOTIFY, notice('mfa-enabled', { email: `ben@${w.domain}` }));
	const xana = await put('fonderie.user.registered', { userId: randomUUID(), email: `xana@${w.domain}`, firstName: 'Xana', lastName: 'Other' });
	const longer = await put(NOTIFY, notice('mfa-enabled', { email: `ana@${w.domain}.evil.example` }));
	const near = await put(w.custom, { userId: randomUUID(), email: `ana.b@${w.domain}`, phone: `${w.phone}9` });
	const invite = await put(NOTIFY, notice('workspace-invitation', { email: `cleo@${w.domain}` }, { pin: '1', workspaceName: 'Acme' }));
	// Someone else took the freed `old` address AFTER the account moved off it.
	const reused = await put('fonderie.user.registered', { userId: randomUUID(), email: w.oldEmail, firstName: 'Dora', lastName: 'Later' });
	const reusedNotice = await put(NOTIFY, notice('email-registration', { email: w.oldEmail }, { pin: '222222', firstName: 'Dora' }));

	const theirs = [registered, changed, changedAgain, toMid, welcome, reset, otp, dead, revoked, mention, unsigned, oldKey];
	const others = [ben, xana, longer, near, invite, reused, reusedNotice];
	const before = await read([...theirs, ...others]);

	const eraser = accountEraser(store, { integrityKey: KEY, retiredIntegrityKeys: [RETIRED] });
	assert.equal(eraser.name, 'events');
	const res = await eraser.erase({ userId: w.userId, email: w.email, phone: w.phone });

	const now = await read([...theirs, ...others]);
	// Deleted: every notification to any of the person's addresses — the
	// current one, the registered one, the one an email-changed notice links.
	for (const id of [changed, changedAgain, toMid, welcome, reset, otp, dead]) {
		assert.equal(now.has(id), false, `${before.get(id)!.payload['type']} notification deleted`);
	}
	// Redacted: personal fields gone, the opaque id kept, the row re-signed.
	assert.deepEqual(now.get(registered)!.payload, {
		userId: w.userId,
		email: 'erased',
		firstName: 'erased',
		lastName: 'erased',
		loginMethod: 'email',
	});
	assert.deepEqual(now.get(mention)!.payload, {
		...before.get(mention)!.payload,
		actor: { label: 'erased', phone: 'erased' },
	});
	assert.deepEqual(now.get(unsigned)!.payload, { userId: w.userId, email: 'erased', phone: 'erased' });
	assert.deepEqual(now.get(oldKey)!.payload, { userId: w.userId, firstName: 'erased' });
	for (const id of [registered, mention, unsigned, oldKey]) {
		assert.equal(typeof now.get(id)!.meta['erasedAt'], 'string', 'the rewrite is recorded');
	}
	assert.equal(now.get(unsigned)!.hmac, null, 'an unsigned row stays unsigned');
	for (const id of [registered, mention, oldKey]) {
		const r = now.get(id)!;
		assert.equal(r.hmac, computeEventHmac(KEY, r), 're-signed with the CURRENT key');
	}
	assert.deepEqual(await tamperedAmong([...theirs, ...others]), [], 'every surviving row verifies');

	// Kept as-is: an event about them with nothing personal, and everyone else.
	assert.deepEqual(now.get(revoked), before.get(revoked));
	for (const id of others) assert.deepEqual(now.get(id), before.get(id), 'not theirs: untouched');

	assert.equal(res.erased, 7 + 4);
	assert.match(res.kept ?? '', /4 event\(s\) kept/);

	// Idempotent.
	const again = await eraser.erase({ userId: w.userId, email: w.email, phone: w.phone });
	assert.deepEqual(again, { erased: 0 });
	assert.deepEqual(await read([...theirs, ...others]), now);
});

test('control: a redaction that is NOT re-signed reads as tampered', { skip }, async () => {
	const w = world();
	const id = await put('fonderie.user.registered', { userId: w.userId, email: w.email, firstName: 'Ana' });
	await store.query(`UPDATE fonderie_events SET payload = payload || '{"email":"erased"}' WHERE id = $1`, [id]);
	assert.deepEqual(await tamperedAmong([id]), [id]);
	// …and the eraser refuses to launder it by re-signing.
	await assert.rejects(
		accountEraser(store, { integrityKey: KEY }).erase({ userId: w.userId, email: w.email, phone: null }),
		/fails its integrity check/,
	);
	assert.deepEqual(await tamperedAmong([id]), [id], 'still reported');
});

test('a notification still being delivered blocks the erasure; nothing changes until it lands', { skip }, async () => {
	const w = world();
	const registered = await put('fonderie.user.registered', { userId: w.userId, email: w.email, firstName: 'Ana' });
	const pending = await put(NOTIFY, notice('account-deletion-scheduled', { email: w.email }, { deleteOn: '2026-11-04' }));
	await delivery(pending, 'pending');
	const before = await read([registered, pending]);

	const eraser = accountEraser(store, { integrityKey: KEY });
	await assert.rejects(eraser.erase({ userId: w.userId, email: w.email, phone: null }), /still being delivered/);
	assert.deepEqual(await read([registered, pending]), before, 'rolled back: nothing half-erased');

	await store.query(`UPDATE fonderie_event_consumers SET status = 'processed' WHERE event_id = $1`, [pending]);
	const res = await eraser.erase({ userId: w.userId, email: w.email, phone: null });
	assert.equal(res.erased, 2);
	const now = await read([registered, pending]);
	assert.equal(now.has(pending), false);
	assert.equal(now.get(registered)!.payload['email'], 'erased');
});

test('a signed row to redact and no integrityKey: refuse rather than leave it reading as tampered', { skip }, async () => {
	const w = world();
	const id = await put('fonderie.user.registered', { userId: w.userId, email: w.email, firstName: 'Ana' });
	const before = await read([id]);
	await assert.rejects(
		accountEraser(store).erase({ userId: w.userId, email: w.email, phone: null }),
		/no integrityKey was given/,
	);
	assert.deepEqual(await read([id]), before);
});

test('a registered address no change notice reaches: theirs for the registration only', { skip }, async () => {
	const w = world();
	// The welcome PIN is published just BEFORE user.registered (auth's order).
	const welcome = await put(NOTIFY, notice('email-registration', { email: w.oldEmail }, { pin: '333333' }));
	const registered = await put('fonderie.user.registered', { userId: w.userId, email: w.oldEmail, firstName: 'Ana' });
	// Later mail to that address cannot be attributed to this account.
	const later = await put(NOTIFY, notice('mfa-enabled', { email: w.oldEmail }));
	const before = await read([welcome, registered, later]);

	const res = await accountEraser(store, { integrityKey: KEY }).erase({ userId: w.userId, email: w.email, phone: null });
	const now = await read([welcome, registered, later]);
	assert.equal(now.has(welcome), false, 'the registration PIN is deleted');
	assert.deepEqual(now.get(registered)!.payload, { userId: w.userId, email: 'erased', firstName: 'erased' });
	assert.deepEqual(now.get(later), before.get(later));
	assert.equal(res.erased, 2);
});
