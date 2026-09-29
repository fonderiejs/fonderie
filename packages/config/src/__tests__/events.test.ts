import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateEventCatalogEntry } from '@fonderie/core';

import { ConfigModule } from '../module';
import { deleteConfigEntry } from '../services/config';

// A store that records every statement, and answers DELETE … RETURNING with
// the rows we choose.
function recordingStore(deleted: number) {
	const sql: Array<{ q: string; params: unknown[] }> = [];
	const store = {
		query: async <T>(q: string, params: unknown[] = []): Promise<T[]> => {
			sql.push({ q, params });
			return (/^\s*DELETE/.test(q) ? Array.from({ length: deleted }, () => ({ key: 'k' })) : []) as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(store),
	};
	return { store, sql };
}

test('deleteConfigEntry: a delete sends the same NOTIFY as a write (R3)', async () => {
	const { store, sql } = recordingStore(1);
	assert.equal(await deleteConfigEntry('WITH_JOBS_SCREEN', 'production', store as never), true);
	const notify = sql.find((s) => /pg_notify\('fonderie_config_changed'/.test(s.q));
	assert.ok(notify, 'NOTIFY sent');
	assert.deepEqual(notify!.params, ['production'], 'payload is the environment, like writes');
});

test('deleteConfigEntry: nothing deleted → no NOTIFY', async () => {
	const { store, sql } = recordingStore(0);
	assert.equal(await deleteConfigEntry('MISSING', 'production', store as never), false);
	assert.ok(!sql.some((s) => /pg_notify/.test(s.q)));
});

test('ConfigModule.describeEvents: one valid public entry, sourced from its NOTIFY, leaking nothing', () => {
	const stub = { query: async () => [], transaction: async (fn: (t: unknown) => unknown) => fn(stub) };
	const entries = new ConfigModule(stub as never, {}).describeEvents();
	assert.equal(entries.length, 1);
	const [e] = entries;
	assert.deepEqual(validateEventCatalogEntry(e!, '@fonderie/config'), []);
	assert.equal(e!.type, 'fonderie.config.changed');
	assert.equal(e!.audience, 'public');
	assert.deepEqual(e!.source, { notify: 'fonderie_config_changed' });
	assert.deepEqual(e!.project!('production'), { environment: 'production' }, 'environment only — no keys, no values');
});
