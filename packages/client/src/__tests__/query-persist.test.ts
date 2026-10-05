import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieClient, QueryStore } from '../index';

// The device snapshot: a cold start opens screens on their last data — and
// never on someone else's. Each test is one guarantee.

// A JWT-shaped access token for `sub`, built at run time (no token literal in
// the source). Only the payload is read client-side; the signature is never
// checked here.
function tokenFor(sub: string): string {
	const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	return `${part({ alg: 'none' })}.${part({ sub, typ: 'access' })}.sig`;
}

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		map,
		getItem: async (k: string) => map.get(k) ?? null,
		setItem: async (k: string, v: string) => {
			map.set(k, v);
		},
	};
}

const settleSave = () => new Promise((r) => setTimeout(r, 300));

test('a cold start for the same user opens on the saved data, marked for a background refresh', async () => {
	const storage = memoryStorage();
	const first = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('u1'), queries: { persist: { storage } } });
	await first.queries.fetch('GET /billing/subscription::ws=w1', async () => ({ plan: 'pro' }));
	await settleSave();

	const restarted = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('u1'), queries: { persist: { storage } } });
	await restarted.queries.hydrated;
	const entry = restarted.queries.peek('GET /billing/subscription::ws=w1');
	assert.deepEqual(entry.data, { plan: 'pro' }, 'shown at once');
	assert.equal(restarted.queries.isStale('GET /billing/subscription::ws=w1'), true, 'and refreshed behind it');
});

test('another user never sees the snapshot', async () => {
	const storage = memoryStorage();
	const a = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('alice'), queries: { persist: { storage } } });
	await a.queries.fetch('GET /workspaces/members::ws=w1', async () => [{ userId: 'alice' }]);
	await settleSave();

	const b = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('bob'), queries: { persist: { storage } } });
	await b.queries.hydrated;
	assert.equal(b.queries.peek('GET /workspaces/members::ws=w1').data, undefined);
});

test('signing out wipes the device copy as well as the screens', async () => {
	const storage = memoryStorage();
	const client = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('u1'), queries: { persist: { storage } } });
	await client.queries.fetch('k', async () => ({ secret: 1 }));
	await settleSave();
	assert.ok(storage.map.get('fonderie.queries.v1'), 'saved while signed in');
	client.setAccessToken(undefined);
	await settleSave();
	assert.equal(storage.map.get('fonderie.queries.v1'), '');
	assert.equal(client.queries.peek('k').data, undefined);
});

test('a token for a different user (no sign-out in between) wipes what the previous one saw', async () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', accessToken: tokenFor('u1') });
	await client.queries.fetch('k', async () => ({ mine: 'u1' }));
	client.setAccessToken(tokenFor('u1')); // a refresh: same user, kept
	assert.deepEqual(client.queries.peek('k').data, { mine: 'u1' });
	client.setAccessToken(tokenFor('u2'));
	assert.equal(client.queries.peek('k').data, undefined);
});

test('filter decides what may sit on the device', async () => {
	const storage = memoryStorage();
	const client = new FonderieClient({
		baseUrl: 'http://api.test',
		accessToken: tokenFor('u1'),
		queries: { persist: { storage, filter: (key) => key.startsWith('GET /billing') } },
	});
	await client.queries.fetch('GET /billing/subscription::ws=', async () => ({ plan: 'pro' }));
	await client.queries.fetch('GET /customers::ws=', async () => [{ email: 'someone@acme.example' }]);
	await settleSave();
	const saved = storage.map.get('fonderie.queries.v1') ?? '';
	assert.match(saved, /billing\/subscription/);
	assert.doesNotMatch(saved, /customers|acme\.example/);
});

test('a restored entry never replaces an answer fetched meanwhile', async () => {
	const storage = memoryStorage();
	storage.map.set(
		'fonderie.queries.v1',
		JSON.stringify({ v: 1, owner: 'u1', savedAt: Date.now(), entries: [['k', { v: 'saved' }, Date.now()]] }),
	);
	const store = new QueryStore({ persist: { storage }, owner: () => 'u1' });
	await store.fetch('k', async () => ({ v: 'live' }));
	await store.hydrate();
	assert.deepEqual(store.peek('k').data, { v: 'live' });
});

test('nothing is saved or loaded without an owner (signed out), and a bad snapshot is ignored', async () => {
	const storage = memoryStorage();
	const anon = new QueryStore({ persist: { storage }, owner: () => undefined });
	await anon.fetch('k', async () => ({ v: 1 }));
	await settleSave();
	assert.equal(storage.map.size, 0);

	storage.map.set('fonderie.queries.v1', '{not json');
	const store = new QueryStore({ persist: { storage }, owner: () => 'u1' });
	await store.hydrate();
	assert.equal(store.peek('k').data, undefined);
});

test('entries older than maxAgeMs are dropped on load', async () => {
	const storage = memoryStorage();
	const old = Date.now() - 10 * 24 * 60 * 60_000;
	storage.map.set(
		'fonderie.queries.v1',
		JSON.stringify({ v: 1, owner: 'u1', savedAt: Date.now(), entries: [['old', { v: 1 }, old], ['new', { v: 2 }, Date.now()]] }),
	);
	const store = new QueryStore({ persist: { storage }, owner: () => 'u1' });
	await store.hydrate();
	assert.equal(store.peek('old').data, undefined);
	assert.deepEqual(store.peek('new').data, { v: 2 });
});
