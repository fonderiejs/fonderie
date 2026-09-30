import assert from 'node:assert/strict';
import { test } from 'node:test';

import { publicConfigHandler, publicConfigValues } from '../public';

function manager(entries: Record<string, unknown>) {
	return {
		get<T>(key: string, fallback: T): T {
			return Object.hasOwn(entries, key) ? (entries[key] as T) : fallback;
		},
	};
}

const STORED = {
	ENABLE_JOB_LISTING: true,
	MAX_ACTIVE_JOBS: 3,
	INTERNAL_PRICING_RULES: { margin: 0.4 },
	stripe_webhook_note: 'server only',
};

test('only listed keys are exposed — everything else stays server-side', () => {
	const values = publicConfigValues(manager(STORED), ['ENABLE_JOB_LISTING', 'MAX_ACTIVE_JOBS']);
	assert.deepEqual(values, { ENABLE_JOB_LISTING: true, MAX_ACTIVE_JOBS: 3 });
	assert.ok(!('INTERNAL_PRICING_RULES' in values));
});

test('no publicKeys configured → nothing exposed', () => {
	assert.deepEqual(publicConfigValues(manager(STORED), undefined), {});
	assert.deepEqual(publicConfigValues(manager(STORED), []), {});
});

test('list form omits unset keys; record form reports the default', () => {
	assert.deepEqual(publicConfigValues(manager({}), ['ENABLE_JOB_LISTING']), {});
	assert.deepEqual(publicConfigValues(manager({}), { ENABLE_JOB_LISTING: false, MAINTENANCE_MESSAGE: '' }), {
		ENABLE_JOB_LISTING: false,
		MAINTENANCE_MESSAGE: '',
	});
	// a stored value wins over the default, including a stored falsy value
	assert.deepEqual(publicConfigValues(manager({ ENABLE_JOB_LISTING: false }), { ENABLE_JOB_LISTING: true }), {
		ENABLE_JOB_LISTING: false,
	});
});

test('prototype names are not readable even if listed', () => {
	assert.deepEqual(publicConfigValues(manager({}), ['constructor', 'toString', '__proto__']), {});
});

test('GET /config/public answers the envelope, with no-store', async () => {
	const res = await publicConfigHandler(manager(STORED), ['ENABLE_JOB_LISTING'])({} as never, async () => new Response());
	assert.equal(res.status, 200);
	assert.equal(res.headers.get('cache-control'), 'no-store');
	const body = (await res.json()) as { reason: string; result: { values: Record<string, unknown> } };
	assert.equal(body.reason, 'PUBLIC_CONFIG_FETCHED');
	assert.deepEqual(body.result, { values: { ENABLE_JOB_LISTING: true } });
	assert.doesNotMatch(JSON.stringify(body), /INTERNAL_PRICING_RULES|server only/);
});

// The field bug: an operator switched a screen off; the app was told at once
// and re-read — and a serverless instance answered from a snapshot cached up
// to the TTL, handing back the old value. No further event came, so the app
// kept it. The route must read fresh.
test('GET /config/public reads fresh — a value changed since the last snapshot is served at once', async () => {
	const db: Record<string, unknown> = { WITH_PROFILE_SCREEN: true };
	let snapshot = { ...db };
	let reloads = 0;
	const m = {
		get<T>(key: string, fallback: T): T {
			return Object.hasOwn(snapshot, key) ? (snapshot[key] as T) : fallback;
		},
		async reload() {
			reloads++;
			await new Promise((r) => setTimeout(r, 5));
			snapshot = { ...db };
		},
	};
	const handler = publicConfigHandler(m, ['WITH_PROFILE_SCREEN']);
	const read = async () =>
		((await (await handler({} as never, async () => new Response())).json()) as { result: { values: Record<string, unknown> } }).result.values;
	assert.deepEqual(await read(), { WITH_PROFILE_SCREEN: true });
	db['WITH_PROFILE_SCREEN'] = false; // the operator's change, not yet in the snapshot
	assert.deepEqual(await read(), { WITH_PROFILE_SCREEN: false });
	assert.equal(reloads, 2);
});
