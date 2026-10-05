import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FonderieApiError, UI_DICTIONARIES, UI_LANGUAGES, localizeApiError } from '../index';

// A refused request, as the reader reads it. Screens showed the server's
// English `explanation` to everyone.

const err = (reason: string, status: number, details?: unknown, explanation = 'English from the server.') =>
	new FonderieApiError(reason, explanation, status, details);

test("English readers keep the server's exact sentence", () => {
	assert.equal(localizeApiError(err('INVALID_PARAMETER', 422, undefined, "address.zip: '12345' is not a postal code (A1A 1A1)"), 'en-CA'),
		"address.zip: '12345' is not a postal code (A1A 1A1)");
});

test("other readers get the code's message, filled from details", () => {
	assert.equal(localizeApiError(err('INVALID_CREDENTIALS', 401), 'fr-CA'), UI_DICTIONARIES.fr.errors.reasons.INVALID_CREDENTIALS);
	const seat = localizeApiError(err('SEAT_LIMIT_REACHED', 402, { limit: 5 }), 'zh-TW');
	assert.match(seat, /5/);
	assert.doesNotMatch(seat, /\{limit\}/);
	assert.notEqual(seat, localizeApiError(err('SEAT_LIMIT_REACHED', 402, { limit: 5 }), 'zh-CN'), 'Traditional and Simplified differ');
});

test('a missing value or an unknown code falls back to the generic message for the status — never half a sentence', () => {
	assert.equal(localizeApiError(err('SEAT_LIMIT_REACHED', 402, {}), 'es-US'), UI_DICTIONARIES.es.errors.generic.paymentRequired);
	assert.equal(localizeApiError(err('SOME_NEW_REASON', 409), 'es-US'), UI_DICTIONARIES.es.errors.generic.conflict);
	assert.equal(localizeApiError(err('INVALID_PARAMETER', 422), 'fr'), UI_DICTIONARIES.fr.errors.generic.validation);
	assert.equal(localizeApiError(err('WHATEVER', 503), 'fr'), UI_DICTIONARIES.fr.errors.generic.unavailable);
	assert.equal(localizeApiError(err('WHATEVER', 500), 'fr'), UI_DICTIONARIES.fr.errors.generic.server);
});

test('offline (status 0) is "could not reach the server" in every language, English included', () => {
	const offline = new FonderieApiError('unknown', 'TypeError: Failed to fetch', 0);
	assert.equal(localizeApiError(offline, 'en-US'), UI_DICTIONARIES.en.errors.generic.network);
	assert.equal(localizeApiError(offline, 'zh-HK'), UI_DICTIONARIES['zh-Hant'].errors.generic.network);
	assert.equal(localizeApiError(null, 'fr'), '');
});

type Tree = { [k: string]: string | Tree };
const leaves = (t: Tree, prefix = ''): Array<[string, string]> =>
	Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));

test('no language is an untranslated copy of English', () => {
	const en = new Map(leaves(UI_DICTIONARIES.en as unknown as Tree));
	for (const lang of UI_LANGUAGES.filter((l) => l !== 'en')) {
		const all = leaves(UI_DICTIONARIES[lang] as unknown as Tree);
		const same = all.filter(([k, v]) => en.get(k) === v).map(([k]) => k);
		assert.ok(same.length < all.length * 0.05, `${lang}: ${same.length} strings identical to English, e.g. ${same.slice(0, 5).join(', ')}`);
	}
});

// The server must send every value a message names, or that message silently
// never shows (localizeApiError falls back to the generic one).
const pkgs = join(import.meta.dirname, '..', '..', '..');
function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		if (f === '__tests__' || f === 'node_modules') return [];
		return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
	});
}
test('every {value} a reason message names is sent in that response\'s details', () => {
	const server = ['auth', 'workspaces', 'billing', 'customers', 'media', 'core']
		.flatMap((p) => sources(join(pkgs, p, 'src')))
		.map((f) => readFileSync(f, 'utf8'))
		.join('\n');
	let checked = 0;
	for (const [reason, text] of Object.entries(UI_DICTIONARIES.en.errors.reasons)) {
		const names = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
		if (names.length === 0) continue;
		const at = [...server.matchAll(new RegExp(`'${reason}'`, 'g'))].map((m) => m.index!);
		assert.ok(at.length > 0, `${reason} is never emitted by the server`);
		for (const name of names) {
			const sent = at.some((i) => new RegExp(`\\b${name}\\b\\s*[:,}]`).test(server.slice(i, i + 600)));
			assert.ok(sent, `${reason}: the server never sends {${name}} in details`);
		}
		checked++;
	}
	assert.ok(checked >= 6, `checked ${checked} messages with values — not a vacuous pass`);
});

test('an archived account: the deletion date in the reader’s language; without it (sign-up), the short sentence', () => {
	const signedIn = err('ACCOUNT_PENDING_DELETION', 403, { requestedAt: '2026-10-04T12:00:00.000Z', deleteOn: '2026-11-03T12:00:00.000Z' });
	const fr = localizeApiError(signedIn, 'fr-CA');
	assert.match(fr, /3 novembre 2026/, fr);
	assert.ok(!fr.includes('T12:00'), 'no raw timestamp');
	assert.match(localizeApiError(signedIn, 'es-US'), /noviembre/);
	assert.equal(
		localizeApiError(err('ACCOUNT_PENDING_DELETION', 409), 'zh-Hant'),
		UI_DICTIONARIES['zh-Hant'].errors.reasons['ACCOUNT_PENDING_DELETION:short'],
	);
});
