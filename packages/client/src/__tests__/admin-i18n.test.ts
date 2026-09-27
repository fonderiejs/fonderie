import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ADMIN_LOCALES, createAdminT, detectAdminLocale, formatAdminDate } from '../admin-i18n';
import en from '../admin-i18n/en';
import es from '../admin-i18n/es';
import fr from '../admin-i18n/fr';

// The compiler guarantees fr/es have the same KEYS as en. It cannot see two
// mistakes a translator makes: an empty string, and a dropped or renamed
// {placeholder} — which renders "{n} users" or loses the number entirely.

type Tree = { [k: string]: string | Tree };
function leaves(t: Tree, prefix = ''): Array<[string, string]> {
	return Object.entries(t).flatMap(([k, v]) =>
		typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
	);
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every locale has a non-empty string for every key, with the same {placeholders} as English', () => {
	const base = new Map(leaves(en as unknown as Tree));
	assert.ok(base.size > 100, `the dictionary is populated (${base.size} keys) — not a vacuous pass`);
	for (const [name, dict] of [
		['fr', fr],
		['es', es],
	] as const) {
		const got = new Map(leaves(dict as unknown as Tree));
		for (const [key, text] of base) {
			const tr = got.get(key);
			assert.ok(tr !== undefined, `${name}: missing ${key}`);
			assert.ok(tr.trim().length > 0, `${name}: empty ${key}`);
			assert.equal(placeholders(tr), placeholders(text), `${name}: ${key} placeholders differ — en "${text}" vs "${tr}"`);
		}
	}
});

test('createAdminT: translates, interpolates, and renders an unknown key as itself', () => {
	assert.equal(createAdminT('fr')('common.save'), 'Enregistrer');
	assert.equal(createAdminT('es')('common.save'), 'Guardar');
	assert.equal(createAdminT()('common.save'), 'Save');
	const t = createAdminT('en');
	assert.equal(t('nope.missing' as never), 'nope.missing');
});

test('detectAdminLocale: first supported browser language, else English', () => {
	assert.equal(detectAdminLocale(['fr-CA', 'en-US']), 'fr');
	assert.equal(detectAdminLocale(['de-DE', 'es-MX']), 'es');
	assert.equal(detectAdminLocale(['de-DE']), 'en');
	assert.equal(detectAdminLocale([]), 'en');
	assert.deepEqual([...ADMIN_LOCALES], ['en', 'fr', 'es']);
});

test('formatAdminDate: dates follow the console language', () => {
	const d = new Date(Date.UTC(2026, 8, 27, 12, 0, 0));
	assert.notEqual(formatAdminDate(d, 'en', 'date'), formatAdminDate(d, 'fr', 'date'), 'en-US and fr-FR order dates differently');
});
