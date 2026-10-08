import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { assertUniqueMigrationNames, runMigrationSets } from '../migrations/collisions';
import type { IStoreAdapter } from '../types';

const root = mkdtempSync(join(tmpdir(), 'fonderie-mig-'));
after(() => rmSync(root, { recursive: true, force: true }));

function dir(name: string, files: string[]): string {
	const d = join(root, name);
	mkdirSync(d, { recursive: true });
	for (const f of files) writeFileSync(join(d, f), 'SELECT 1;');
	return d;
}

// A store that fails the test if anything reaches the database: the refusal
// must happen before a single statement runs, not after the first module.
const untouchable = new Proxy({} as IStoreAdapter, {
	get(_t, prop) {
		if (prop === 'then') return undefined;
		return () => {
			throw new Error(`store.${String(prop)} was called — the refusal came too late`);
		};
	},
});

test('distinct filenames across modules pass', () => {
	const a = dir('ok-a', ['001_users.sql', '002_sessions.sql']);
	const b = dir('ok-b', ['100_plans.sql', 'notes.txt']);
	assert.doesNotThrow(() => assertUniqueMigrationNames([a, ['billing', b]]));
});

test('a filename shipped by two modules is refused, naming the file and both directories', () => {
	const a = dir('clash-auth', ['001_init.sql', '002_more.sql']);
	const b = dir('clash-app', ['001_init.sql']);
	assert.throws(
		() => assertUniqueMigrationNames([['auth', a], ['app', b]]),
		(err: Error) =>
			err.message.includes('"001_init.sql"') &&
			err.message.includes(`auth (${a})`) &&
			err.message.includes(`app (${b})`) &&
			err.message.includes('Refusing to run'),
	);
});

test('only .sql files count, and a missing directory is not a collision', () => {
	const a = dir('txt-a', ['README.md']);
	const b = dir('txt-b', ['README.md']);
	assert.doesNotThrow(() => assertUniqueMigrationNames([a, b, join(root, 'absent')]));
});

test('the same directory listed twice is not a collision with itself', () => {
	const a = dir('twice', ['001_x.sql']);
	assert.doesNotThrow(() => assertUniqueMigrationNames([a, a]));
});

test('runMigrationSets refuses before touching the database', async () => {
	const a = dir('run-a', ['010_x.sql']);
	const b = dir('run-b', ['010_x.sql']);
	await assert.rejects(runMigrationSets(untouchable, [a, b]), /filename collision/);
});
