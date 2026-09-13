import { test } from 'node:test';
import assert from 'node:assert/strict';

import { webhookStats } from '../services/provider-health';

function stubStore(rows: Record<string, unknown[]>) {
	return {
		query: async <T>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) return rows['subs'] as T[];
			if (sql.includes('fonderie_wallet_ledger')) return rows['ledger'] as T[];
			return [] as T[];
		},
		transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
	} as never;
}

test('webhookStats: reports the subscription count, so a null lastEventAt is readable', async () => {
	// The whole reason the count is here: `lastEventAt: null` means "nobody has
	// subscribed" OR "subscriptions exist and no webhook was ever accepted".
	// Only the second is an outage.
	const nobodySubscribed = await webhookStats(
		stubStore({ subs: [{ total: '0', last: null }], ledger: [{ total: '0', last: null }] }),
	);
	assert.equal(nobodySubscribed.subscriptions, 0);
	assert.equal(nobodySubscribed.lastEventAt, null);

	const outage = await webhookStats(
		stubStore({ subs: [{ total: '4', last: null }], ledger: [{ total: '0', last: null }] }),
	);
	assert.equal(outage.subscriptions, 4);
	assert.equal(outage.lastEventAt, null);
	// Identical lastEventAt, opposite meanings — the caller can now tell.
	assert.notEqual(nobodySubscribed.subscriptions, outage.subscriptions);
});

test('webhookStats: surfaces the accepted-event and purchase timestamps', async () => {
	const at = new Date('2026-09-13T10:00:00.000Z');
	const bought = new Date('2026-09-13T11:00:00.000Z');
	const stats = await webhookStats(
		stubStore({ subs: [{ total: '2', last: at }], ledger: [{ total: '3', last: bought }] }),
	);
	assert.equal(stats.subscriptions, 2);
	assert.deepEqual(stats.lastEventAt, at);
	assert.equal(stats.purchases, 3);
	assert.deepEqual(stats.lastPurchaseAt, bought);
});

test('webhookStats: an empty database does not throw', async () => {
	const stats = await webhookStats(stubStore({ subs: [], ledger: [] }));
	assert.deepEqual(stats, {
		subscriptions: 0,
		lastEventAt: null,
		purchases: 0,
		lastPurchaseAt: null,
	});
});
