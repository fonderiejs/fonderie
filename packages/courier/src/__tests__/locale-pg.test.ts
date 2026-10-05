import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { defineLocales } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { insertMessageLog, setMessageResolvedLocale } from '../log';
import { getMigrationsPath } from '../migrations';
import { setTemplate } from '../templates/admin';
import { DBTemplateResolver, DefaultTemplates } from '../templates/resolver';

// Locale resolution against real Postgres. The mocked tests emulate the query;
// these prove it: the ANY() array match, case-insensitivity on legacy rows,
// and the resolved_locale column the dispatcher writes.
//
//   COURIER_PG_URL=postgres://... npm test -w @fonderie/courier

const PG_URL = process.env['COURIER_PG_URL'];
const skip = PG_URL ? false : 'set COURIER_PG_URL to run';
const TYPE = 'pg-locale-test';

let store: IStoreAdapter & { end?: () => Promise<void>; close?: () => Promise<void> };

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	// Through the runner: it takes the migrations advisory lock, so this suite
	// and the others migrating the same database at once cannot race the
	// CREATE TABLEs (raw SQL here collided with the eraser suite: 23505).
	const { InternalMigrationRunner } = await import('@fonderie/store');
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query('DELETE FROM fonderie_courier_templates WHERE type = $1', [TYPE]);
	await store.query('DELETE FROM fonderie_courier_template_revisions WHERE type = $1', [TYPE]);
	await setTemplate({ type: TYPE, locale: null, text: 'app default' }, store);
	await setTemplate({ type: TYPE, locale: 'fr-CA', text: 'saved fr-CA' }, store);
	// A row saved before tags were canonicalized.
	await store.query(
		`INSERT INTO fonderie_courier_templates (type, locale, text, active) VALUES ($1, 'en-gb', 'saved en-gb', true)`,
		[TYPE],
	);
	await setTemplate({ type: TYPE, locale: 'de-DE', text: 'inactive de', active: false }, store);
});

after(async () => {
	if (!PG_URL) return;
	await store.query('DELETE FROM fonderie_courier_templates WHERE type = $1', [TYPE]);
	await store.query('DELETE FROM fonderie_courier_template_revisions WHERE type = $1', [TYPE]);
	await store.end?.();
	await store.close?.();
});

test('real PG: chain, built-in language, legacy case, inactive rows, system locale', { skip }, async () => {
	const defaults = new DefaultTemplates([
		{ [TYPE]: { text: 'built-in en', locales: { fr: { text: 'built-in fr' }, de: { text: 'built-in de' } } } },
	]);
	const resolver = new DBTemplateResolver(store, defaults);
	resolver.setLocales(defineLocales({ fallbacks: { 'fr-BE': ['fr-FR', 'fr-CA'] } }));
	const sent = async (locale?: string) => {
		const r = await resolver.resolve(TYPE, {}, locale);
		return `${r.text} @ ${r.locale}`;
	};
	assert.equal(await sent('fr-BE'), 'saved fr-CA @ fr-CA', 'along the declared chain');
	assert.equal(await sent('fr-CH'), 'built-in fr @ fr', 'no chain: the built-in French, not the English default');
	assert.equal(await sent('en-GB'), 'saved en-gb @ en-GB', 'a legacy lower-case row still matches');
	assert.equal(await sent('de-DE'), 'built-in de @ de', 'an inactive saved row is skipped');
	assert.equal(await sent('ja-JP'), 'app default @ en-US', 'unsupported: the system locale');
	assert.equal(await sent(), 'app default @ en-US');
});

test('real PG: the message log keeps the version sent beside the locale asked for', { skip }, async () => {
	const id = await insertMessageLog(
		{ messageType: TYPE, channel: 'email', recipient: 'a@example.com', locale: 'fr-BE' },
		store,
	);
	await setMessageResolvedLocale(id, 'fr-CA', store);
	const [row] = await store.query<{ locale: string; resolved_locale: string }>(
		'SELECT locale, resolved_locale FROM fonderie_message_log WHERE id = $1',
		[id],
	);
	assert.deepEqual(row, { locale: 'fr-BE', resolved_locale: 'fr-CA' });
	await store.query('DELETE FROM fonderie_message_log WHERE id = $1', [id]);
});
