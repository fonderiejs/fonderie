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
