import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { Dispatcher } from '../dispatcher';
import type { ICourierMessage, ITemplateResolver } from '../types';

// The recipient-language lookup against @fonderie/auth's REAL users table and
// migrations: case-insensitive email, phone-only accounts, no match.
//
//   COURIER_PG_URL=postgres://... npm test -w @fonderie/courier

const PG_URL = process.env['COURIER_PG_URL'];
const skip = PG_URL ? false : 'set COURIER_PG_URL to run';
const DOMAIN = 'recipient-locale.acme.example';
let store: IStoreAdapter & { end?: () => Promise<void> };

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { getMigrationsPath } = await import('@fonderie/auth/migrations');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE '%@${DOMAIN}' OR phone LIKE '+1555000%'`);
	await store.query(`INSERT INTO fonderie_users (email, locale) VALUES ($1, 'fr-CA')`, [`marie@${DOMAIN}`]);
	await store.query(`INSERT INTO fonderie_users (email, phone, locale) VALUES (NULL, '+15550001234', 'zh-Hant')`);
});

after(async () => {
	if (!store) return;
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE '%@${DOMAIN}' OR phone LIKE '+1555000%'`);
	await store.end?.();
});

test('the account behind an email (any case) or a phone decides; no account → the fallback', { skip }, async () => {
	const asked: Array<string | undefined> = [];
	const resolver: ITemplateResolver = {
		async resolve(_t, _d, locale) {
			asked.push(locale);
			return { subject: 's', text: 't' };
		},
	};
	// No store passed to the log path matters here; the lookup needs one.
	const d = new Dispatcher({ channels: { receipt: ['email'] } }, resolver, store);
	d.registerChannel({ name: 'email', async send() {} });
	const send = (recipient: ICourierMessage['recipient']) =>
		d.dispatch({ type: 'receipt', recipient, data: {}, fallbackLocale: 'es-US' });
	await send({ email: `MARIE@${DOMAIN.toUpperCase()}`, phone: null, deviceToken: null });
	await send({ email: null, phone: '+15550001234', deviceToken: null });
	await send({ email: `nobody@${DOMAIN}`, phone: null, deviceToken: null });
	assert.deepEqual(asked, ['fr-CA', 'zh-Hant', 'es-US']);
});
