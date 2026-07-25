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

// ── ConfigModule shape ──────────────────────────────────────

test('ConfigModule: satisfies IFonderieModule interface', async () => {
	const { ConfigModule } = await import('../module');
	const store = makeStore();
	const mod = new ConfigModule(store);

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
			// version lock read (setConfigEntry / rollback)
			if (sql.includes('SELECT version FROM fonderie_config')) {
				return (returnEntry ? [{ version: returnEntry.version }] : []) as unknown as T[];
			}
			// revision inserts return nothing
			if (sql.includes('fonderie_config_revisions')) return [] as T[];
			if (sql.includes('DELETE')) {
				return (returnEntry ? [{ key: returnEntry.key }] : []) as unknown as T[];
			}
			// entry upsert (RETURNING) or plain SELECT
			if (returnEntry && (sql.includes('RETURNING') || sql.includes('SELECT'))) {
				return [returnEntry] as unknown as T[];
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
	version: 1,
	updatedBy: null,
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

// ── optimistic concurrency (version index) ───────────────────────

test('setConfigEntry: ifVersion mismatch throws ConfigConflictError', async () => {
	const { setConfigEntry, ConfigConflictError } = await import('../services/config');
	// store reports current version 5; caller writes against version 1 → conflict
	const store = makeWriteStore({ ...baseEntry, version: 5 });
	await assert.rejects(
		() => setConfigEntry({ key: 'feature.dark-mode', value: false, ifVersion: 1 }, store),
		(err: unknown) => {
			assert.ok(err instanceof ConfigConflictError);
			assert.equal((err as InstanceType<typeof ConfigConflictError>).currentVersion, 5);
			assert.equal((err as InstanceType<typeof ConfigConflictError>).expectedVersion, 1);
			return true;
		},
	);
});

test('setConfigEntry: ifVersion match commits (no conflict)', async () => {
	const { setConfigEntry } = await import('../services/config');
	const store = makeWriteStore({ ...baseEntry, version: 5 });
	const result = await setConfigEntry(
		{ key: 'feature.dark-mode', value: false, ifVersion: 5 },
		store,
	);
	assert.equal(result.key, 'feature.dark-mode');
});

// ── event propagation: emit on write ─────────────────────────────

test('setConfigEntry: emits pg_notify on the config-changed channel', async () => {
	const { setConfigEntry } = await import('../services/config');
	const seen: string[] = [];
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			seen.push(sql);
			if (sql.includes('SELECT version FROM fonderie_config')) return [{ version: 1 }] as unknown as T[];
			if (sql.includes('RETURNING')) return [baseEntry] as unknown as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	await setConfigEntry({ key: 'feature.dark-mode', value: true, ifVersion: 1 }, stub);
	assert.ok(
		seen.some((s) => s.includes("pg_notify('fonderie_config_changed'")),
		'a pg_notify on fonderie_config_changed must fire',
	);
});

// ── secrets: encryption + masking ────────────────────────────────

test('createAesGcmEncryptor: round-trips and detects tampering', async () => {
	const { createAesGcmEncryptor } = await import('../crypto');
	const key = 'a'.repeat(64); // 32 bytes hex
	const enc = createAesGcmEncryptor(key);
	const cipher = enc.encrypt('sk_live_secret');
	assert.notEqual(cipher, 'sk_live_secret'); // not plaintext
	assert.equal(enc.decrypt(cipher), 'sk_live_secret'); // round-trip
	// tamper the ciphertext body → auth tag rejects it
	const [iv, tag, data = ''] = cipher.split(':');
	const flipped = data.startsWith('0') ? `1${data.slice(1)}` : `0${data.slice(1)}`;
	assert.throws(() => enc.decrypt(`${iv}:${tag}:${flipped}`));
});

test('createAesGcmEncryptor: rejects a wrong-length key', async () => {
	const { createAesGcmEncryptor } = await import('../crypto');
	assert.throws(() => createAesGcmEncryptor('tooshort'), /32 bytes/);
});

test('noopEncryptor: identity', async () => {
	const { noopEncryptor } = await import('../crypto');
	assert.equal(noopEncryptor.encrypt('x'), 'x');
	assert.equal(noopEncryptor.decrypt('x'), 'x');
});

test('getSecret / listSecrets: never return the value (masked)', async () => {
	const { getSecret, listSecrets } = await import('../services/secrets');
	// capture the SQL to prove `value` is never selected on the masked reads
	let sql = '';
	const store: IStoreAdapter = {
		query: async <T = unknown>(q: string): Promise<T[]> => {
			sql += q;
			return [{ key: 'k', environment: 'all', description: null, active: true, version: 1, updatedBy: null, updatedAt: 'x' }] as unknown as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const one = await getSecret('k', 'all', store);
	await listSecrets('all', store);
	assert.ok(!('value' in (one as object)), 'masked entry has no value field');
	assert.doesNotMatch(sql, /\bvalue\b/, 'masked reads must not select the value column');
});

test('setSecret: ifVersion mismatch throws ConfigConflictError (OCC)', async () => {
	const { setSecret } = await import('../services/secrets');
	const { ConfigConflictError } = await import('../services/config');
	// store reports current version 5; caller writes against version 1 → conflict
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('SELECT version FROM fonderie_secrets')) return [{ version: 5 }] as unknown as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	await assert.rejects(
		() => setSecret({ key: 'stripe.key', value: 'x', ifVersion: 1 }, store),
		(err: unknown) => {
			assert.ok(err instanceof ConfigConflictError);
			assert.equal((err as InstanceType<typeof ConfigConflictError>).currentVersion, 5);
			return true;
		},
	);
});

// ── admin HTTP surface + bootstrap auth ──────────────────────────

function adminCtx(opts: { token?: string; params?: Record<string, string>; body?: unknown; url?: string }) {
	const headers = new Headers();
	if (opts.token) headers.set('authorization', `Bearer ${opts.token}`);
	const req = new Request(opts.url ?? 'http://x/admin/config', { headers });
	return { request: req, meta: { params: opts.params, body: opts.body } } as unknown as Parameters<
		Awaited<ReturnType<typeof import('../admin')['buildAdminRoutes']>>[number][2]
	>[0];
}
const noNext = async () => new Response(null);
function pick(routes: Array<[string, string, unknown]>, method: string, path: string) {
	const r = routes.find(([m, p]) => m === method && p === path);
	if (!r) throw new Error(`route ${method} ${path} not found`);
	return r[2] as (ctx: unknown, next: unknown) => Promise<Response>;
}

test('admin: rejects a request with no/invalid token (401)', async () => {
	const { buildAdminRoutes } = await import('../admin');
	const routes = buildAdminRoutes(makeWriteStore(baseEntry), 'sekret');
	const list = pick(routes, 'GET', '/admin/config');
	assert.equal((await list(adminCtx({}), noNext)).status, 401);
	assert.equal((await list(adminCtx({ token: 'wrong' }), noNext)).status, 401);
});

test('admin: lists config with a valid token (200)', async () => {
	const { buildAdminRoutes } = await import('../admin');
	const routes = buildAdminRoutes(makeWriteStore(baseEntry), 'sekret');
	const list = pick(routes, 'GET', '/admin/config');
	assert.equal((await list(adminCtx({ token: 'sekret' }), noNext)).status, 200);
});

test('admin: PUT config saves (200); stale ifVersion → 409', async () => {
	const { buildAdminRoutes } = await import('../admin');
	const store = makeWriteStore({ ...baseEntry, version: 5 });
	const put = pick(buildAdminRoutes(store, 'sekret'), 'PUT', '/admin/config/:key');
	const ok = await put(adminCtx({ token: 'sekret', params: { key: 'k' }, body: { value: true } }), noNext);
	assert.equal(ok.status, 200);
	const conflict = await put(
		adminCtx({ token: 'sekret', params: { key: 'k' }, body: { value: true, ifVersion: 1 } }),
		noNext,
	);
	assert.equal(conflict.status, 409);
});

test('ConfigModule: registers admin routes only when adminToken is set', async () => {
	const { ConfigModule } = await import('../module');
	const added: string[] = [];
	const app = {
		use: () => {},
		addRoute: (m: string, p: string) => added.push(`${m} ${p}`),
	} as unknown as Parameters<InstanceType<typeof ConfigModule>['install']>[0];

	const mod = new ConfigModule(makeStore(), { adminToken: 'sekret' });
	await mod.install(app);
	assert.ok(added.some((r) => r === 'GET /admin/config'), 'admin routes registered with token');
	assert.ok(added.some((r) => r === 'POST /admin/secrets/:key/reveal'));
	mod.manager.stop(); // release the poll interval so the test process can exit

	const added2: string[] = [];
	const app2 = { use: () => {}, addRoute: (m: string, p: string) => added2.push(`${m} ${p}`) } as unknown as typeof app;
	const mod2 = new ConfigModule(makeStore(), {});
	await mod2.install(app2);
	assert.equal(added2.length, 0, 'no admin routes without a token');
	mod2.manager.stop();
});
