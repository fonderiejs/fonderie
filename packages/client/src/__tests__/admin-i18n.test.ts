import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	ADMIN_LOCALES,
	adminLocaleNames,
	adminLocaleTags,
	createAdminT,
	detectAdminLocale,
	formatAdminDate,
} from '../admin-i18n';
import en from '../admin-i18n/en';
import es from '../admin-i18n/es';
import fr from '../admin-i18n/fr';
import zhHans from '../admin-i18n/zh-Hans';
import zhHant from '../admin-i18n/zh-Hant';

// The compiler guarantees fr/es/zh-Hans/zh-Hant have the same KEYS as en. It cannot see two
// mistakes a translator makes: an empty string, and a dropped or renamed
// {placeholder} — which renders "{n} users" or loses the number entirely.

type Tree = { [k: string]: string | Tree };
function leaves(t: Tree, prefix = ''): Array<[string, string]> {
	return Object.entries(t).flatMap(([k, v]) =>
		typeof v === 'string'
			? [[`${prefix}${k}`, v] as [string, string]]
			: leaves(v, `${prefix}${k}.`),
	);
}
const placeholders = (s: string) =>
	[...s.matchAll(/\{(\w+)\}/g)]
		.map((m) => m[1])
		.sort()
		.join(',');

test('every locale has a non-empty string for every key, with the same {placeholders} as English', () => {
	const base = new Map(leaves(en as unknown as Tree));
	assert.ok(
		base.size > 100,
		`the dictionary is populated (${base.size} keys) — not a vacuous pass`,
	);
	for (const [name, dict] of [
		['fr', fr],
		['es', es],
		['zh-Hans', zhHans],
		['zh-Hant', zhHant],
	] as const) {
		const got = new Map(leaves(dict as unknown as Tree));
		for (const [key, text] of base) {
			const tr = got.get(key);
			assert.ok(tr !== undefined, `${name}: missing ${key}`);
			assert.ok(tr.trim().length > 0, `${name}: empty ${key}`);
			assert.equal(
				placeholders(tr),
				placeholders(text),
				`${name}: ${key} placeholders differ — en "${text}" vs "${tr}"`,
			);
		}
	}
});

test('createAdminT: translates, interpolates, and renders an unknown key as itself', () => {
	assert.equal(createAdminT('fr')('common.save'), 'Enregistrer');
	assert.equal(createAdminT('es')('common.save'), 'Guardar');
	assert.notEqual(createAdminT('zh-Hans')('common.save'), 'Save');
	// Traditional is its own text, not the Simplified copy under another name.
	const hans = new Map(leaves(zhHans as unknown as Tree));
	const differing = leaves(zhHant as unknown as Tree).filter(([k, v]) => hans.get(k) !== v).length;
	assert.ok(differing > hans.size / 2, `${differing} of ${hans.size} strings differ between zh-Hans and zh-Hant`);
	assert.equal(createAdminT()('common.save'), 'Save');
	const t = createAdminT('en');
	assert.equal(t('nope.missing' as never), 'nope.missing');
});

test('detectAdminLocale: first supported browser language, else English', () => {
	assert.equal(detectAdminLocale(['fr-CA', 'en-US']), 'fr');
	assert.equal(detectAdminLocale(['de-DE', 'es-MX']), 'es');
	assert.equal(detectAdminLocale(['de-DE']), 'en');
	assert.equal(detectAdminLocale([]), 'en');
	assert.deepEqual([...ADMIN_LOCALES], ['en', 'fr', 'es', 'zh-Hans', 'zh-Hant']);
	// Chinese by script, whatever the region tag says.
	for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-CA']) assert.equal(detectAdminLocale([tag]), 'zh-Hant', tag);
	for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-US']) assert.equal(detectAdminLocale([tag]), 'zh-Hans', tag);
});

test('formatAdminDate: dates follow the console language', () => {
	const d = new Date(Date.UTC(2026, 8, 27, 12, 0, 0));
	assert.notEqual(
		formatAdminDate(d, 'en', 'date'),
		formatAdminDate(d, 'fr', 'date'),
		'en-US and fr-FR order dates differently',
	);
});

test('the shared locale maps are frozen: an embedding app cannot rename a language for everyone', () => {
	assert.ok(Object.isFrozen(adminLocaleNames));
	assert.ok(Object.isFrozen(adminLocaleTags));
	assert.throws(() => {
		'use strict';
		(adminLocaleNames as Record<string, string>).fr = 'French';
	}, TypeError);
	assert.equal(adminLocaleNames.fr, 'Français');
	for (const l of ADMIN_LOCALES)
		assert.ok(adminLocaleNames[l] && adminLocaleTags[l], `${l} has a name and a tag`);
});

test('localizeReason: translated by domain + reason, metadata interpolated, enum values translated, English fallback', async () => {
	const { localizeReason } = await import('../index');
	const priceMissing = {
		message: 'plan:starter:yearly: price price_1X not found at the provider',
		domain: 'billing',
		reason: 'PRICE_NOT_FOUND',
		metadata: { ref: 'plan:starter:yearly', price: 'price_1X' },
	};
	assert.equal(
		localizeReason(priceMissing, 'fr'),
		'plan:starter:yearly : le prix price_1X n’existe pas chez le prestataire de paiement.',
	);
	assert.equal(
		localizeReason(priceMissing, 'es'),
		'plan:starter:yearly: el precio price_1X no existe en el proveedor de pagos.',
	);
	// An enum-like value is itself translated — no English left in the sentence.
	const drift = {
		message: 'x',
		domain: 'billing',
		reason: 'SUBSCRIPTION_MISSING_AT_PROVIDER',
		metadata: {
			subscriber: 'workspace:w1',
			subscription: 'sub_1',
			status: 'active',
			impact: 'OVER_GRANTING',
		},
	};
	assert.match(localizeReason(drift, 'fr'), /l’accès est accordé sans paiement\.$/);
	// Unknown reason (a newer brick, an app's own check) or no reason: the English message.
	assert.equal(
		localizeReason({ message: 'app said so', domain: 'billing', reason: 'SOMETHING_NEW' }, 'fr'),
		'app said so',
	);
	assert.equal(localizeReason({ message: 'plain sentence' }, 'fr'), 'plain sentence');
});
