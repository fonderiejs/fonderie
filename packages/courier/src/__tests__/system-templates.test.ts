import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';
import { SEEDED_TEMPLATE_TYPES } from '../templates/admin';
import { describeTemplateAdminRoutes, isSystemTemplate } from '../templates/admin-routes';

// A built-in email's default-locale row is edit-and-rollback only. Deleting a
// seeded row with no code default would leave that email as a raw data dump.

test('SEEDED_TEMPLATE_TYPES matches migration 002 exactly', () => {
	const sql = readFileSync(join(getMigrationsPath(), '002_seed_templates.sql'), 'utf8');
	const seeded = [
		...sql.matchAll(/SELECT pg_temp\._seed_courier_template\(\s*'([a-z][a-z_-]*)'/g),
	].map((m) => m[1]);
	assert.ok(seeded.length > 0, 'parsed at least one seeded type (not a vacuous pass)');
	assert.deepEqual([...seeded].sort(), [...SEEDED_TEMPLATE_TYPES].sort());
});

test('isSystemTemplate: default-locale row of a seeded or module type; never a locale variant or an app type', () => {
	const moduleTypes = new Set(['billing-receipt']);
	assert.equal(isSystemTemplate('password-reset', null, moduleTypes), true);
	assert.equal(isSystemTemplate('billing-receipt', null, moduleTypes), true);
	assert.equal(
		isSystemTemplate('password-reset', 'fr', moduleTypes),
		false,
		'a locale variant is the operator’s',
	);
	assert.equal(
		isSystemTemplate('weekly-digest', null, moduleTypes),
		false,
		'an app-added type is the operator’s',
	);
	assert.equal(
		isSystemTemplate('_layout', null, moduleTypes),
		false,
		'the layout falls back to the built-in shell',
	);
});

function app(systemTypes: string[] = ['billing-receipt']) {
	const deleted: Array<[unknown, unknown]> = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			if (sql.startsWith('DELETE')) {
				deleted.push([params[0], params[1]]);
				return [{ type: params[0] }] as unknown as T[];
			}
			if (sql.includes('ORDER BY type')) {
				return [
					{ type: 'password-reset', locale: null, text: 't', active: true, version: 1 },
					{ type: 'password-reset', locale: 'fr', text: 't', active: true, version: 1 },
					{ type: 'weekly-digest', locale: null, text: 't', active: true, version: 1 },
				] as unknown as T[];
			}
			return [];
		},
		transaction: async (fn) => fn(store),
	};
	const mod: IFonderieModule = {
		name: 'test-admin',
		install(a: IFonderieApp) {
			for (const r of describeTemplateAdminRoutes(store, { systemTypes }))
				a.addRoute(r.method, `/_admin${r.path}`, ...r.handlers);
		},
	};
	const fonderie = new FonderieApp(
		defineConfig({ db: { url: 'postgres://localhost/test' } }),
	).register(mod);
	return { fonderie, deleted };
}

test('DELETE: a built-in default row is refused (409 SYSTEM_TEMPLATE) and nothing is deleted', async () => {
	const { fonderie, deleted } = app();
	await fonderie.boot();
	for (const path of ['/_admin/templates/password-reset', '/_admin/templates/billing-receipt']) {
		const res = await fonderie.handle(new Request(`http://localhost${path}`, { method: 'DELETE' }));
		assert.equal(res.status, 409, path);
		assert.equal(((await res.json()) as { reason: string }).reason, 'SYSTEM_TEMPLATE');
	}
	assert.equal(deleted.length, 0);
});

test('DELETE: a locale variant and an app-added type are deletable', async () => {
	const { fonderie, deleted } = app();
	await fonderie.boot();
	const variant = await fonderie.handle(
		new Request('http://localhost/_admin/templates/password-reset?locale=fr', { method: 'DELETE' }),
	);
	assert.equal(variant.status, 200);
	const custom = await fonderie.handle(
		new Request('http://localhost/_admin/templates/weekly-digest', { method: 'DELETE' }),
	);
	assert.equal(custom.status, 200);
	assert.deepEqual(deleted, [
		['password-reset', 'fr'],
		['weekly-digest', null],
	]);
});

test('GET list marks system rows, so a console can hide Delete', async () => {
	const { fonderie } = app();
	await fonderie.boot();
	const res = await fonderie.handle(new Request('http://localhost/_admin/templates'));
	const rows = (
		(await res.json()) as {
			result: Array<{ type: string; locale: string | null; system: boolean }>;
		}
	).result;
	assert.deepEqual(
		rows.map((r) => `${r.type}:${r.locale ?? 'default'}:${r.system}`),
		['password-reset:default:true', 'password-reset:fr:false', 'weekly-digest:default:false'],
	);
});
