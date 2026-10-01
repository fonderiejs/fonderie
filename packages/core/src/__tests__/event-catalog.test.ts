import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp } from '../app';
import { defineConfig } from '../config';
import { isValidTopicFilter, matchesTopic, mergeEventCatalogs, validateEventCatalogEntry, type IEventCatalogEntry } from '../event-catalog';
import type { IFonderieModule } from '../types';

const ok: IEventCatalogEntry<{ customerId: string; workspaceId: string; email: string }> = {
	type: 'fonderie.customer.created',
	description: 'A customer was added to the workspace',
	audience: 'workspace',
	scope: (p) => ({ workspaceId: p.workspaceId }),
	project: (p) => ({ customerId: p.customerId }),
};

test('validateEventCatalogEntry: a correct entry has no problems', () => {
	assert.deepEqual(validateEventCatalogEntry(ok as IEventCatalogEntry, '@fonderie/customers'), []);
	assert.deepEqual(
		validateEventCatalogEntry({ type: 'fonderie.config.changed', description: 'Public config changed', audience: 'public', source: { notify: 'fonderie_config_changed' } }, '@fonderie/config'),
		[],
	);
});

test('validateEventCatalogEntry: each rule fires', () => {
	const problems = [
		validateEventCatalogEntry({ ...ok, type: 'NotDotted' } as IEventCatalogEntry, 'm'),
		validateEventCatalogEntry({ ...ok, description: '' } as IEventCatalogEntry, 'm'),
		validateEventCatalogEntry({ ...ok, audience: 'everyone' } as never, 'm'),
		validateEventCatalogEntry({ ...ok, scope: undefined } as unknown as IEventCatalogEntry, 'm'),
		validateEventCatalogEntry({ ...ok, source: { notify: 'bad channel; DROP' } } as IEventCatalogEntry, 'm'),
	].map((p) => p.join(' '));
	assert.match(problems[0]!, /dotted lowercase/);
	assert.match(problems[1]!, /description is required/);
	assert.match(problems[2]!, /audience must be/);
	assert.match(problems[3]!, /needs scope\(payload\)/);
	assert.match(problems[4]!, /Postgres channel name/);
});

test('mergeEventCatalogs: a type declared by two modules throws, naming both', () => {
	assert.throws(
		() => mergeEventCatalogs([{ name: '@fonderie/a', entries: [ok as IEventCatalogEntry] }, { name: '@fonderie/b', entries: [ok as IEventCatalogEntry] }]),
		/'fonderie\.customer\.created' is declared by both @fonderie\/a and @fonderie\/b/,
	);
});

test('app.eventCatalog(): merges registered modules, sorted, tagged with their module', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	const mod = (name: string, entries: IEventCatalogEntry[]): IFonderieModule => ({ name, install() {}, describeEvents: () => entries });
	app.register(mod('@fonderie/customers', [ok as IEventCatalogEntry]));
	app.register(mod('@fonderie/config', [{ type: 'fonderie.config.changed', description: 'Public config changed', audience: 'public' }]));
	app.register({ name: '@x/silent', install() {} }); // declares nothing: contributes nothing
	const catalog = app.eventCatalog();
	assert.deepEqual(catalog.map((e) => [e.type, e.module]), [
		['fonderie.config.changed', '@fonderie/config'],
		['fonderie.customer.created', '@fonderie/customers'],
	]);
});

test('project(): only what the entry chooses reaches the client', () => {
	const projected = ok.project!({ customerId: 'c1', workspaceId: 'w1', email: 'secret@acme.example' });
	assert.deepEqual(projected, { customerId: 'c1' });
});

test('matchesTopic: *, exact, and segment prefix — nothing else', () => {
	assert.ok(matchesTopic('*', 'fonderie.customer.created'));
	assert.ok(matchesTopic('fonderie.customer.created', 'fonderie.customer.created'));
	assert.ok(matchesTopic('fonderie.customer.*', 'fonderie.customer.created'));
	assert.ok(!matchesTopic('fonderie.customer.*', 'fonderie.customers.created'), 'prefix is per segment');
	assert.ok(!matchesTopic('fonderie.customer.*', 'fonderie.customer'), 'prefix needs something after it');
	assert.ok(!matchesTopic('fonderie.custom', 'fonderie.customer.created'), 'no implicit prefix');
	// Client input is never a regex:
	assert.ok(!matchesTopic('fonderie.(customer|billing).*', 'fonderie.customer.created'));
	assert.ok(!matchesTopic('.*', 'fonderie.customer.created'));
});

test('isValidTopicFilter: rejects anything that is not *, a type or prefix.*', () => {
	for (const f of ['*', 'fonderie.customer.created', 'fonderie.customer.*', 'fonderie.*']) assert.ok(isValidTopicFilter(f), f);
	for (const f of ['', '.*', 'fonderie.(a|b)', 'fonderie.*.created', 'Fonderie.X', 'a b']) assert.ok(!isValidTopicFilter(f), f);
});

test("'fonderie.*' is reserved for @fonderie bricks: an app module declaring it is refused, with its own-prefix fix", () => {
	const problems = validateEventCatalogEntry({ ...ok, type: 'fonderie.job.assigned' } as IEventCatalogEntry, 'acme');
	assert.equal(problems.length, 1);
	assert.match(problems[0]!, /reserved for @fonderie bricks/);
	assert.match(problems[0]!, /'app\.job\.assigned'/);
	// Look-alike names are not bricks.
	assert.equal(validateEventCatalogEntry(ok as IEventCatalogEntry, 'fonderie-customers').length, 1);
	assert.equal(validateEventCatalogEntry(ok as IEventCatalogEntry, '@fonderie-community/x').length, 1);
	// The app's own prefix is fine, and so is a brick declaring its own event.
	assert.deepEqual(validateEventCatalogEntry({ ...ok, type: 'acme.job.assigned' } as IEventCatalogEntry, 'acme'), []);
	assert.deepEqual(validateEventCatalogEntry(ok as IEventCatalogEntry, '@fonderie/customers'), []);
});

test('boot() validates the event catalog for every app, not only those that install realtime delivery', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	let installed = false;
	app.register({ name: 'acme', install() { installed = true; }, describeEvents: () => [{ ...ok, type: 'fonderie.job.assigned' } as IEventCatalogEntry] });
	await assert.rejects(() => app.boot(), /reserved for @fonderie bricks/);
	assert.equal(installed, false, 'refused before any module installs');
});

test('boot() refuses two modules declaring the same type', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	const entry = { ...ok, type: 'acme.job.assigned' } as IEventCatalogEntry;
	app.register({ name: 'acme-jobs', install() {}, describeEvents: () => [entry] });
	app.register({ name: 'acme-dispatch', install() {}, describeEvents: () => [entry] });
	await assert.rejects(() => app.boot(), /declared by both acme-dispatch and acme-jobs/);
});
