import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';

// Migration 006 upgrades the seeded workspace-invitation row so the accept link
// reaches people — but only when nobody edited it. Real Postgres: the guard is
// SQL (version, editor, exact text), and so is the revision history.
//
//   COURIER_PG_URL=postgres://... npm test -w @fonderie/courier

const PG_URL = process.env['COURIER_PG_URL'];
const skip = PG_URL ? false : 'set COURIER_PG_URL to run';
const dir = getMigrationsPath();
const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
const sql = (f: string) => readFileSync(join(dir, f), 'utf8');

let store: IStoreAdapter & { end?: () => Promise<void>; close?: () => Promise<void> };

const row = async () =>
	(
		await store.query<{ subject: string; html: string; text: string; version: number; updated_by: string | null }>(
			`SELECT subject, html, text, version, updated_by FROM fonderie_courier_templates
			 WHERE type = 'workspace-invitation' AND locale IS NULL`,
		)
	)[0]!;
const revisions = async () =>
	store.query<{ version: number; actor: string }>(
		`SELECT version, actor FROM fonderie_courier_template_revisions
		 WHERE type = 'workspace-invitation' AND locale IS NULL ORDER BY version`,
	);

// Back to "an install that ran 001–005": the seeded row, no history.
async function seededInstall(): Promise<void> {
	await store.query(`DELETE FROM fonderie_courier_templates WHERE type = 'workspace-invitation'`);
	await store.query(`DELETE FROM fonderie_courier_template_revisions WHERE type = 'workspace-invitation'`);
	await store.query(sql('002_seed_templates.sql'));
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	for (const f of files.filter((f) => f < '006')) await store.query(sql(f));
});

after(async () => {
	if (!store) return;
	await seededInstall();
	await store.query(sql('006_invitation_template_link.sql'));
	await (store.end ?? store.close)?.call(store);
});

test('an untouched seed gets the link, the workspace and the inviter, recorded as a revision', { skip }, async () => {
	await seededInstall();
	assert.doesNotMatch((await row()).text, /acceptUrl/);
	await store.query(sql('006_invitation_template_link.sql'));
	const r = await row();
	assert.match(r.html, /\{\{#acceptUrl\}\}<p><a href="\{\{acceptUrl\}\}"/);
	assert.match(r.text, /\{\{workspaceName\}\}\{\{#inviterName\}\} by \{\{inviterName\}\}\{\{\/inviterName\}\}/);
	assert.match(r.subject, /\{\{workspaceName\}\}/);
	assert.equal(r.version, 2);
	assert.equal(r.updated_by, 'fonderie:migration');
	assert.deepEqual(
		(await revisions()).map((x) => [x.version, x.actor]),
		[
			[1, 'fonderie:seed'],
			[2, 'fonderie:migration'],
		],
	);
	// Running again changes nothing.
	await store.query(sql('006_invitation_template_link.sql'));
	assert.equal((await row()).version, 2);
	assert.equal((await revisions()).length, 2);
});

test("an operator's own copy is left alone", { skip }, async () => {
	await seededInstall();
	await store.query(
		`UPDATE fonderie_courier_templates SET text = 'Our own words: {{pin}}', version = 2, updated_by = 'op@acme.example'
		 WHERE type = 'workspace-invitation' AND locale IS NULL`,
	);
	await store.query(sql('006_invitation_template_link.sql'));
	const r = await row();
	assert.equal(r.text, 'Our own words: {{pin}}');
	assert.equal(r.updated_by, 'op@acme.example');
	assert.equal((await revisions()).length, 0);
});
