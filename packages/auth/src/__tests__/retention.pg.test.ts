import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';
import { purgeSoftDeletedUsers } from '../services/retention';

// The retention purge on a REAL Postgres: every account it removes is
// announced (`fonderie.user.purged` — billing deletes the payment provider's
// customer on it). Before, one bulk DELETE removed them all and an emit loop
// announced them after; an emit that threw mid-loop lost every remaining
// announcement, for accounts already gone — so their provider customers were
// never deleted. The bus fails on the SECOND announcement here; afterwards
// every account that is gone must have been announced.
//
//   AUTH_PG_URL=postgres://... npm test -w @fonderie/auth

const PG_URL = process.env['AUTH_PG_URL'];
const skip = PG_URL ? false : 'set AUTH_PG_URL to run';
const DOMAIN = 'retention.acme.example';
// Only this suite's rows are this old: the purge window below reaches nothing
// else in the shared CI database.
const AGE_DAYS = 100_000;
const WINDOW_DAYS = 99_999;

let store: IStoreAdapter & { end?: () => Promise<void> };

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE $1`, [`%@${DOMAIN}`]);
});

after(async () => {
	if (!PG_URL) return;
	await store.query(`DELETE FROM fonderie_users WHERE email LIKE $1`, [`%@${DOMAIN}`]);
	await store.end?.();
});

async function agedAccounts(n: number): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < n; i++) {
		// A legal hold keeps the account-deletion schedule (another suite, same
		// database) off these rows; the retention purge does not consult it.
		const [row] = await store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, deleted_at, deletion_hold_at)
			 VALUES ($1, now() - make_interval(days => $2), now()) RETURNING id`,
			[`r${i}-${Date.now()}@${DOMAIN}`, AGE_DAYS],
		);
		ids.push(row!.id);
	}
	return ids;
}

const present = async (ids: string[]) =>
	(
		await store.query<{ id: string }>(`SELECT id FROM fonderie_users WHERE id = ANY($1::uuid[])`, [ids])
	).map((r) => r.id);

test('a bus failure mid-purge: no account is gone without its announcement; the next run finishes', {
	skip,
}, async () => {
	const ids = await agedAccounts(3);
	const announced: string[] = [];
	let calls = 0;
	const flaky = {
		emit: async (_type: string, payload: unknown) => {
			if (++calls === 2) throw new Error('bus down');
			announced.push((payload as { userId: string }).userId);
		},
	};
	await purgeSoftDeletedUsers(store, { olderThanDays: WINDOW_DAYS, bus: flaky }).catch(() => undefined);

	const left = await present(ids);
	const gone = ids.filter((id) => !left.includes(id));
	const silent = gone.filter((id) => !announced.includes(id));
	assert.deepEqual(silent, [], `${silent.length} of ${gone.length} purged account(s) never announced`);

	// The next run, with the bus back, purges and announces the rest.
	const bus = {
		emit: async (_type: string, payload: unknown) => {
			announced.push((payload as { userId: string }).userId);
		},
	};
	const n = await purgeSoftDeletedUsers(store, { olderThanDays: WINDOW_DAYS, bus });
	assert.equal(n, left.length);
	assert.deepEqual(await present(ids), []);
	assert.deepEqual([...announced].sort(), [...ids].sort(), 'every account announced exactly once');
});

test('without a bus: one statement purges every aged account', { skip }, async () => {
	const ids = await agedAccounts(2);
	assert.equal(await purgeSoftDeletedUsers(store, { olderThanDays: WINDOW_DAYS }), 2);
	assert.deepEqual(await present(ids), []);
});
