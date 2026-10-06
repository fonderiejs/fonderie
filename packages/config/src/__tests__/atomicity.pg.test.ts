import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { createAesGcmEncryptor } from '../crypto';
import { getMigrationsPath } from '../migrations';
import { ConfigTypeChangeError, setConfigEntry } from '../services/config';
import { rotateSecretKey } from '../services/rotate';
import { revealSecret, setSecret } from '../services/secrets';

// Writes racing each other on a REAL Postgres: advisory locks and row locks are
// behaviours of the database; a mocked store would only prove itself.
//
//   CONFIG_PG_URL=postgres://... npm test -w @fonderie/config
//
// A rotation re-encrypts EVERY secret, and the key check is a single row, so
// this suite runs in a schema of its own — the shared CI database keeps other
// suites' rows out of its way and its rows out of theirs.

const PG_URL = process.env['CONFIG_PG_URL'];
const skip = PG_URL ? false : 'set CONFIG_PG_URL to run';
const SCHEMA = `config_atomicity_${process.pid}_${Date.now()}`;

type PgStore = IStoreAdapter & { end?: () => Promise<void> };
let admin: PgStore;
let store: PgStore;

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter } = await import('@fonderie/store');
	admin = new PGAdapter(PG_URL) as PgStore;
	await admin.query(`CREATE SCHEMA ${SCHEMA}`);
	const url = new URL(PG_URL);
	url.searchParams.set('options', `-c search_path=${SCHEMA},public`);
	store = new PGAdapter(url.toString()) as PgStore;
	const dir = getMigrationsPath();
	for (const f of readdirSync(dir)
		.filter((x) => x.endsWith('.sql'))
		.sort()) {
		await store.query(readFileSync(join(dir, f), 'utf8'));
	}
});

after(async () => {
	if (!PG_URL) return;
	await store.end?.();
	await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
	await admin.end?.();
});

test('two first writes of one key with different kinds: one saves, the other is a type change', {
	skip,
}, async () => {
	for (let round = 0; round < 5; round++) {
		const key = `race.kind.${round}`;
		const results = await Promise.allSettled([
			setConfigEntry({ key, value: true }, store),
			setConfigEntry({ key, value: 'yes' }, store),
		]);
		const refused = results.filter(
			(r) => r.status === 'rejected' && r.reason instanceof ConfigTypeChangeError,
		);
		assert.equal(
			refused.length,
			1,
			`round ${round}: ${results.map((r) => r.status).join(', ')} — both kinds were saved`,
		);
		const [{ n }] = (await store.query<{ n: string }>(
			`SELECT count(*)::text AS n FROM fonderie_config_revisions WHERE key = $1`,
			[key],
		)) as [{ n: string }];
		assert.equal(Number(n), 1, 'one version, not a silent type change on top of it');
	}
});

// The rotation's transaction is held open after it has read every row, so the
// writes below are certain to arrive mid-rotation.
function slowStore(base: PgStore, hold: Promise<void>): IStoreAdapter {
	return {
		query: base.query.bind(base),
		transaction: (fn) =>
			base.transaction(async (tx) =>
				fn({
					query: async (sql, params) => {
						if (sql.trimStart().startsWith('UPDATE fonderie_secrets')) await hold;
						return tx.query(sql, params);
					},
					transaction: (nested) => nested(tx),
				} as IStoreAdapter),
			),
	};
}

test('a rotation and secret writes racing it: every value stays readable under the new key', {
	skip,
}, async () => {
	const oldKey = createAesGcmEncryptor('11'.repeat(32));
	const newKey = createAesGcmEncryptor('22'.repeat(32));
	await setSecret({ key: 'race.existing', value: 'before' }, store, oldKey);

	let release!: () => void;
	const hold = new Promise<void>((r) => (release = r));
	const rotation = rotateSecretKey(slowStore(store, hold), oldKey, newKey);
	await new Promise((r) => setTimeout(r, 200));
	// An instance that still holds the old key, writing while the rotation runs:
	// over a row the rotation has read, and a key it has never seen.
	const writes = Promise.allSettled([
		setSecret({ key: 'race.existing', value: 'during' }, store, oldKey),
		setSecret({ key: 'race.new', value: 'during' }, store, oldKey),
	]);
	await new Promise((r) => setTimeout(r, 200));
	release();
	await rotation;
	const settled = await writes;

	for (const key of ['race.existing', 'race.new']) {
		const [row] = await store.query<{ value: string }>(
			`SELECT value FROM fonderie_secrets WHERE key = $1`,
			[key],
		);
		if (row) {
			assert.doesNotThrow(() => newKey.decrypt(row.value), `${key} is unreadable under the new key`);
		}
	}
	const revisions = await store.query<{ key: string; version: number; value: string }>(
		`SELECT key, version, value FROM fonderie_secret_revisions`,
	);
	for (const r of revisions) {
		assert.doesNotThrow(
			() => newKey.decrypt(r.value),
			`revision ${r.key} v${r.version} is unreadable under the new key`,
		);
	}
	assert.ok(
		settled.every((s) => s.status === 'rejected'),
		'the old-key instance is refused, not stored',
	);
	assert.equal(await revealSecret('race.existing', 'all', store, newKey), 'before');

	// The new key writes normally, and the old one stays refused.
	await setSecret({ key: 'race.existing', value: 'after' }, store, newKey);
	assert.equal(await revealSecret('race.existing', 'all', store, newKey), 'after');
	await assert.rejects(
		setSecret({ key: 'race.later', value: 'x' }, store, oldKey),
		/not using the key/,
	);
});
