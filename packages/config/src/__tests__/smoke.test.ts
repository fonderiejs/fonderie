import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IConfigEntry } from '../types';

import { RemoteConfigManager } from '../manager';

// ── Stub store ────────────────────────────────────────────────────

function makeStore(
	entries: Array<{ key: string; value: string; environment: string }> = [],
): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(): Promise<T[]> => entries as unknown as T[],
		transaction: async (fn) => fn(stub),
	};

	return stub;
}

// ── RemoteConfigManager ───────────────────────────────────────────

test('get: returns fallback when no snapshot loaded', () => {
	const manager = new RemoteConfigManager(makeStore(), { ttl: 60_000 });
	const value = manager.get('some.key', 'default');
	assert.equal(value, 'default');
});

test('get: returns value after refresh', async () => {
	const store = makeStore([
		{ key: 'feature.enabled', value: 'true', environment: 'all' },
		{ key: 'rate.limit', value: '100', environment: 'all' },
	]);

	const manager = new RemoteConfigManager(store, { ttl: 60_000 });
	await manager.refresh();

	assert.equal(manager.get('feature.enabled', false), true);
	assert.equal(manager.get('rate.limit', 0), 100);
});

test('get: environment-specific overrides all', async () => {
	const store = makeStore([
		{ key: 'feature.enabled', value: 'false', environment: 'all' },
		{ key: 'feature.enabled', value: 'true', environment: 'production' },
	]);

	const manager = new RemoteConfigManager(store, {
		ttl: 60_000,
		environment: 'production',
	});

	await manager.refresh();

	assert.equal(manager.get('feature.enabled', false), true);
});

test('get: returns fallback for missing key', async () => {
	const store = makeStore([{ key: 'other.key', value: '"hello"', environment: 'all' }]);
	const manager = new RemoteConfigManager(store, { ttl: 60_000 });
	await manager.refresh();

	assert.equal(manager.get('missing.key', 42), 42);
});

test('all: returns all entries as flat record', async () => {
	const store = makeStore([
		{ key: 'a', value: '"hello"', environment: 'all' },
		{ key: 'b', value: '42', environment: 'all' },
	]);

	const manager = new RemoteConfigManager(store, { ttl: 60_000 });
	await manager.refresh();

	const all = manager.all();
	assert.equal(all['a'], 'hello');
	assert.equal(all['b'], 42);
});

test('isStale: true before first refresh', () => {
	const manager = new RemoteConfigManager(makeStore(), { ttl: 60_000 });
	assert.equal(manager.isStale(), true);
});

test('isStale: false immediately after refresh', async () => {
	const manager = new RemoteConfigManager(makeStore(), { ttl: 60_000 });
	await manager.refresh();
	assert.equal(manager.isStale(), false);
});

test('stop: clears the polling interval', async () => {
	const manager = new RemoteConfigManager(makeStore(), { ttl: 100 });
	await manager.boot();
	manager.stop();
	assert.ok(true); // no error thrown
});

// ── RemoteConfigModule shape ──────────────────────────────────────

test('RemoteConfigModule: satisfies IFonderieModule interface', async () => {
	const { RemoteConfigModule } = await import('../module');
	const store = makeStore();
	const mod = new RemoteConfigModule(store);

	assert.equal(mod.name, '@fonderie/config');
	assert.ok(typeof mod.install === 'function');
	assert.ok(mod.manager instanceof RemoteConfigManager);
});

// ── getConfig helper ──────────────────────────────────────────────

test('getConfig: reads value from ctx.meta', async () => {
	const { getConfig } = await import('../middlewares/config-context');
	const { CONFIG_MANAGER_KEY } = await import('../manager');

	const store = makeStore([{ key: 'maintenance.mode', value: 'false', environment: 'all' }]);
	const manager = new RemoteConfigManager(store, { ttl: 60_000 });
	await manager.refresh();

	const ctx = { meta: { [CONFIG_MANAGER_KEY]: manager } };
	assert.equal(getConfig(ctx, 'maintenance.mode', true), false);
});

test('getConfig: returns fallback when manager not in ctx', async () => {
	const { getConfig } = await import('../middlewares/config-context');
	const ctx = { meta: {} };
	assert.equal(getConfig(ctx, 'any.key', 'fallback'), 'fallback');
});

// ── Config admin services ─────────────────────────────────────────

function makeWriteStore(returnEntry?: IConfigEntry): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (returnEntry && (sql.includes('INSERT') || sql.includes('SELECT'))) {
				return [returnEntry] as unknown as T[];
			}
			if (sql.includes('DELETE') && returnEntry) {
				return [{ key: returnEntry.key }] as unknown as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

const baseEntry: IConfigEntry = {
	key: 'feature.dark-mode',
	value: 'true',
	environment: 'all',
	description: 'Enable dark mode',
	active: true,
	updatedAt: '2026-05-08T00:00:00.000Z',
};

test('setConfigEntry: upserts and returns entry', async () => {
	const { setConfigEntry } = await import('../services/config');
	const store = makeWriteStore(baseEntry);
	const result = await setConfigEntry(
		{ key: 'feature.dark-mode', value: true, description: 'Enable dark mode' },
		store,
	);
	assert.equal(result.key, 'feature.dark-mode');
	assert.equal(result.environment, 'all');
});

test('getConfigEntry: returns entry when found', async () => {
	const { getConfigEntry } = await import('../services/config');
	const store = makeWriteStore(baseEntry);
	const result = await getConfigEntry('feature.dark-mode', 'all', store);
	assert.equal(result?.key, 'feature.dark-mode');
});

test('getConfigEntry: returns null when not found', async () => {
	const { getConfigEntry } = await import('../services/config');
	const store = makeWriteStore(undefined);
	const result = await getConfigEntry('missing', 'all', store);
	assert.equal(result, null);
});

test('deleteConfigEntry: returns true when deleted', async () => {
	const { deleteConfigEntry } = await import('../services/config');
	const store = makeWriteStore(baseEntry);
	const deleted = await deleteConfigEntry('feature.dark-mode', 'all', store);
	assert.ok(deleted);
});

test('deleteConfigEntry: returns false when not found', async () => {
	const { deleteConfigEntry } = await import('../services/config');
	const store = makeWriteStore(undefined);
	const deleted = await deleteConfigEntry('missing', 'all', store);
	assert.ok(!deleted);
});

// ── getMigrationsPath ─────────────────────────────────────────────

test('getMigrationsPath: returns a string path', async () => {
	const { getMigrationsPath } = await import('../migrations/index');
	const path = getMigrationsPath();
	assert.ok(typeof path === 'string');
	assert.ok(path.includes('migrations'));
});
