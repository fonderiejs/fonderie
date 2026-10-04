import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FonderieClient, UI_DICTIONARIES, UI_LANGUAGES, createUiT, resolveUiLanguage, uiLocaleFor } from '../index';

// The prebuilt screens' words. The compiler guarantees every language has
// English's KEYS; it cannot see an empty string or a dropped {placeholder}
// (which renders "{min}" or loses the number), nor a "Traditional" that is
// the Simplified copy under another name.

type Tree = { [k: string]: string | Tree };
const leaves = (t: Tree, prefix = ''): Array<[string, string]> =>
	Object.entries(t).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every language has a non-empty string for every key, with the same {placeholders} as English', () => {
	const en = new Map(leaves(UI_DICTIONARIES.en as unknown as Tree));
	assert.ok(en.size > 60, `the dictionary is populated (${en.size} keys) — not a vacuous pass`);
	for (const lang of UI_LANGUAGES) {
		const got = new Map(leaves(UI_DICTIONARIES[lang] as unknown as Tree));
		for (const [key, text] of en) {
			const tr = got.get(key);
			assert.ok(tr && tr.trim(), `${lang}: ${key} is empty`);
			assert.equal(placeholders(tr), placeholders(text), `${lang}: ${key} placeholders`);
		}
	}
});

test('each domain is populated in English, and Traditional is its own text', () => {
	for (const [domain, words] of Object.entries(UI_DICTIONARIES.en)) {
		assert.ok(leaves(words as unknown as Tree).length > 0, `${domain} has no words`);
	}
	const hans = new Map(leaves(UI_DICTIONARIES['zh-Hans'] as unknown as Tree));
	const hant = leaves(UI_DICTIONARIES['zh-Hant'] as unknown as Tree);
	const differing = hant.filter(([k, v]) => hans.get(k) !== v).length;
	assert.ok(differing > hant.length / 2, `${differing} of ${hant.length} strings differ between zh-Hans and zh-Hant`);
});

test('a tag picks the shipped language: regions fold, Chinese goes by script, the rest is English', () => {
	const cases: Array<[string, string]> = [
		['fr-CA', 'fr'], ['fr', 'fr'], ['es-US', 'es'], ['es-MX', 'es'], ['en-CA', 'en'],
		['zh', 'zh-Hans'], ['zh-CN', 'zh-Hans'], ['zh-SG', 'zh-Hans'], ['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh-MO', 'zh-Hant'],
		['de-DE', 'en'], ['not a tag', 'en'],
	];
	for (const [tag, want] of cases) assert.equal(resolveUiLanguage(tag), want, tag);
	assert.equal(createUiT('fr-CA')('auth.login.forgotPassword'), 'Mot de passe oublié ?');
	assert.equal(createUiT('fr-CA')('auth.register.passwordTooShort', { min: 8 }), 'Le mot de passe doit contenir au moins 8 caractères.');
	assert.equal(createUiT('de')('auth.login.title'), 'Sign In');
	assert.equal(createUiT('en')('auth.nope' as never), 'auth.nope');
});

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

test('the client carries its UI language: every sub-client finds it, it changes live, requests send it', async () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', locale: 'fr-ca' });
	assert.equal(client.getLocale(), 'fr-CA');
	for (const sub of [client, client.auth, client.billing, client.customers, client.workspaces, client.audit, client.webhooks]) {
		assert.equal(uiLocaleFor(sub)?.get(), 'fr-CA');
	}
	const seen: string[] = [];
	const off = client.onLocaleChange((t) => seen.push(t));
	client.setLocale('zh-TW');
	client.setLocale('zh-TW'); // unchanged: no second notice
	client.setLocale('!!'); // invalid: ignored
	off();
	assert.deepEqual(seen, ['zh-TW']);
	assert.equal(uiLocaleFor(client.auth)?.get(), 'zh-TW');

	const headers: Array<string | null> = [];
	globalThis.fetch = (async (_url: string, init: RequestInit) => {
		headers.push(new Headers(init.headers).get('accept-language'));
		return new Response(JSON.stringify({ reason: 'OK', explanation: '', result: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
	}) as typeof fetch;
	await client.workspaces.listWorkspaces();
	assert.deepEqual(headers, ['zh-TW']);
});

test('without a locale the client takes the device language', () => {
	const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	Object.defineProperty(globalThis, 'navigator', { value: { languages: ['es-US', 'en-US'] }, configurable: true });
	try {
		assert.equal(new FonderieClient({ baseUrl: 'http://api.test' }).getLocale(), 'es-US');
	} finally {
		if (nav) Object.defineProperty(globalThis, 'navigator', nav);
		else delete (globalThis as { navigator?: unknown }).navigator;
	}
});

test('a name is written in the order the language writes it', async () => {
	const { formatPersonName } = await import('../index');
	assert.equal(formatPersonName('小明', '王', 'zh-Hant'), '王小明');
	assert.equal(formatPersonName('Marie', 'Tremblay', 'fr-CA'), 'Marie Tremblay');
	assert.equal(formatPersonName('', 'Tremblay', 'en'), 'Tremblay');
	assert.equal(formatPersonName(null, null, 'en'), '');
});
