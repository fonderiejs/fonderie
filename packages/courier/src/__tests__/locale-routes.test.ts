import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, defineConfig, defineLocales } from '@fonderie/core';
import type { IFonderieApp, IFonderieModule, ILocaleSettings } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { describeTemplateAdminRoutes } from '../templates/admin-routes';
import { DefaultTemplates } from '../templates/resolver';

// The template admin routes speak the app's locales: the untagged row is the
// system locale's version, so a copy tagged with it is refused; tags are stored
// canonical; the preview draws the shell in the chosen language.

function app(locales?: ILocaleSettings) {
	const params: unknown[][] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(_sql: string, p: unknown[] = []): Promise<T[]> => {
			params.push(p);
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const mod: IFonderieModule = {
		name: 'test-admin',
		install(a: IFonderieApp) {
			const opts = locales ? { locales: () => locales } : {};
			for (const r of describeTemplateAdminRoutes(store, opts))
				a.addRoute(r.method, `/_admin${r.path}`, ...r.handlers);
		},
	};
	const fonderie = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } })).register(mod);
	const put = (locale: string) =>
		fonderie.handle(
			new Request(`http://localhost/_admin/templates/welcome?locale=${encodeURIComponent(locale)}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: 'x' }),
			}),
		);
	return { fonderie, params, put };
}

const reasonOf = async (res: Response) => ((await res.json()) as { reason: string }).reason;

test('PUT: a copy tagged with the system locale is refused (409 DEFAULT_LOCALE), in any spelling', async () => {
	const { fonderie, params, put } = app();
	await fonderie.boot();
	for (const tag of ['en-US', 'en-us', 'EN-US']) {
		const res = await put(tag);
		assert.equal(res.status, 409, tag);
		assert.equal(await reasonOf(res), 'DEFAULT_LOCALE');
	}
	assert.equal(params.length, 0, 'nothing was written');
});

test('PUT: the guard follows the configured system locale', async () => {
	const { fonderie, put } = app(defineLocales({ default: 'en-CA' }));
	await fonderie.boot();
	assert.equal(await reasonOf(await put('en-ca')), 'DEFAULT_LOCALE');
	assert.notEqual((await put('en-US')).status, 409, 'en-US is an ordinary market when en-CA is the system locale');
});

test('PUT: tags are stored canonical, and a non-tag is refused', async () => {
	const { fonderie, params, put } = app();
	await fonderie.boot();
	await put('fr-ca');
	const written = params.flat();
	assert.ok(written.includes('fr-CA'), 'stored as fr-CA');
	assert.ok(!written.includes('fr-ca'), 'never as typed');
	const bad = await put('not a tag');
	assert.equal(bad.status, 422);
	assert.equal(await reasonOf(bad), 'INVALID');
});

test('preview: the built-in shell is drawn in the chosen language', async () => {
	const { fonderie } = app();
	await fonderie.boot();
	const res = await fonderie.handle(
		new Request('http://localhost/_admin/templates/welcome/preview?locale=fr-CA', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ text: 'Bonjour', html: '<p>Bonjour</p>' }),
		}),
	);
	assert.equal(res.status, 200);
	const { result } = (await res.json()) as { result: { html: string } };
	assert.ok(result.html.includes('lang="fr"'));
	assert.ok(result.html.includes('Propulsé par'));
});

// ── catalog, built-in copy, who-receives-what ──────────────────────────────

function catalogApp() {
	const saved = [
		{ type: 'password-reset', locale: null, text: 'app en', active: true, version: 3, updatedAt: '2026-09-01' },
		{ type: 'password-reset', locale: 'fr-CA', text: 'app fr-CA', active: true, version: 1, updatedAt: '2026-09-02' },
		{ type: 'weekly-digest', locale: 'fr', text: 'digest', active: true, version: 1, updatedAt: '2026-09-03' },
		{ type: '_layout', locale: null, text: 'shell', active: true, version: 1, updatedAt: '2026-09-04' },
	];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, p: unknown[] = []): Promise<T[]> => {
			if (sql.includes('ORDER BY type')) return saved as T[];
			// chooseCopy's lookup: rows of the type, untagged or in the chain.
			const [type, chain] = p as [string, string[]];
			return saved
				.filter((r) => r.type === type && (r.locale === null || chain.includes(r.locale.toLowerCase())))
				.map((r) => ({ locale: r.locale, subject: null, html: null, text: r.text })) as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const defaults = new DefaultTemplates([
		{
			'password-reset': { subject: 'Reset', text: 'en {{pin}}', locales: { fr: { subject: 'Réinitialiser', text: 'fr {{pin}}' }, es: { subject: 'Restablecer', text: 'es {{pin}}' } } },
			'payment-failed': { text: 'failed', locales: { fr: { text: 'échec' }, es: { text: 'fallo' } } },
		},
	]);
	const settings = defineLocales({ fallbacks: { 'fr-BE': ['fr-FR', 'fr-CA'] } });
	const mod: IFonderieModule = {
		name: 'test-admin',
		install(a: IFonderieApp) {
			for (const r of describeTemplateAdminRoutes(store, { defaults, locales: () => settings, systemTypes: defaults.types() }))
				a.addRoute(r.method, `/_admin${r.path}`, ...r.handlers);
		},
	};
	const fonderie = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } })).register(mod);
	const get = async (path: string) => {
		const res = await fonderie.handle(new Request(`http://localhost/_admin${path}`));
		return { status: res.status, body: (await res.json()) as { result: any } };
	};
	return { fonderie, get };
}

test('catalog: every email — saved or built-in only — with its languages and versions; never the layout', async () => {
	const { fonderie, get } = catalogApp();
	await fonderie.boot();
	const { status, body } = await get('/template-catalog');
	assert.equal(status, 200);
	assert.equal(body.result.defaultLocale, 'en-US');
	assert.deepEqual(body.result.fallbacks, { 'fr-BE': ['fr-FR', 'fr-CA'] });
	const byType = Object.fromEntries(body.result.emails.map((e: any) => [e.type, e]));
	assert.deepEqual(Object.keys(byType), ['password-reset', 'payment-failed', 'weekly-digest'], 'sorted; _layout excluded');
	assert.deepEqual(byType['payment-failed'].builtIn, { default: true, languages: ['es', 'fr'] });
	assert.deepEqual(byType['payment-failed'].versions, [], 'built-in only: nothing saved, still listed');
	assert.equal(byType['payment-failed'].system, true);
	assert.deepEqual(byType['password-reset'].versions.map((v: any) => v.locale), [null, 'fr-CA']);
	assert.deepEqual(byType['weekly-digest'].builtIn, { default: false, languages: [] });
	assert.equal(byType['weekly-digest'].system, false);
});

test('built-in: the copy in a language, the English for the default, 404 when none ships', async () => {
	const { fonderie, get } = catalogApp();
	await fonderie.boot();
	const fr = await get('/templates/password-reset/built-in?locale=fr-CA');
	assert.equal(fr.status, 200);
	assert.deepEqual([fr.body.result.locale, fr.body.result.subject], ['fr', 'Réinitialiser']);
	const en = await get('/templates/password-reset/built-in');
	assert.deepEqual([en.body.result.locale, en.body.result.text], ['en-US', 'en {{pin}}']);
	assert.equal((await get('/templates/password-reset/built-in?locale=de')).status, 404);
	assert.equal((await get('/templates/weekly-digest/built-in')).status, 404);
});

test('resolve: who receives what, decided like a real send', async () => {
	const { fonderie, get } = catalogApp();
	await fonderie.boot();
	const be = (await get('/templates/password-reset/resolve?locale=fr-be')).body.result;
	assert.deepEqual(be, { requested: 'fr-BE', chain: ['fr-BE', 'fr-FR', 'fr-CA'], defaultLocale: 'en-US', sent: 'fr-CA', source: 'saved' });
	const ch = (await get('/templates/password-reset/resolve?locale=fr-CH')).body.result;
	assert.deepEqual([ch.sent, ch.source], ['fr', 'built-in'], "no chain: Fonderie's French over the app's English");
	const de = (await get('/templates/password-reset/resolve?locale=de-DE')).body.result;
	assert.deepEqual([de.sent, de.source], ['en-US', 'saved'], 'the saved default');
	const pf = (await get('/templates/payment-failed/resolve')).body.result;
	assert.deepEqual([pf.sent, pf.source, pf.chain], ['en-US', 'built-in', []]);
	assert.equal((await get('/templates/nothing-here/resolve?locale=fr')).status, 404);
});
