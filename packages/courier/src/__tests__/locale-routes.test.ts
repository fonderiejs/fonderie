import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, defineConfig, defineLocales } from '@fonderie/core';
import type { IFonderieApp, IFonderieModule, ILocaleSettings } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { describeTemplateAdminRoutes } from '../templates/admin-routes';

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
