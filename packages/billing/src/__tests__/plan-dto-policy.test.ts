import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { IPlanDTO } from '../dtos/billing';
import { planController } from '../controllers/plan.controller';
import { PriceCache } from '../services/price-cache';

// GET /plans used to answer `seats: null, features: []` for a configured plan
// whose policy limits seats and enables features — the stored row's columns are
// only written by the plan-admin routes. The DTO now reflects the policy.

function row(name: string, over: Record<string, unknown> = {}) {
	return {
		id: `id-${name}`,
		name,
		seats: null,
		trialDays: 0,
		monthlyAmount: name === 'free' ? null : 900,
		monthlyPriceId: name === 'free' ? null : `price_${name}_monthly`,
		yearlyAmount: null,
		yearlyPriceId: null,
		description: '',
		tier: name === 'free' ? 0 : 1,
		features: [],
		metadata: {},
		...over,
	};
}

function storeOf(rows: unknown[]): IStoreAdapter {
	const s: IStoreAdapter = {
		query: async <T = unknown>(): Promise<T[]> => rows as T[],
		transaction: async (fn) => fn(s),
	};
	return s;
}

const PLANS = [
	{
		name: 'free',
		policy: {
			jobs: { limit: 10 },
			seats: { limit: 1 },
			'api-calls': { limit: 1000, window: '1d' },
			analytics: { enabled: false },
		},
	},
	{
		name: 'starter',
		monthly: { amount: 900n, priceId: 'price_starter_monthly' },
		policy: { jobs: { limit: null }, seats: { limit: 5 }, analytics: { enabled: true } },
	},
];

function config(extra: Partial<IBillingConfig> = {}): IBillingConfig {
	return {
		provider: {
			name: 'stub',
			async resolvePriceById() {
				return { unitAmount: 1200n, currency: 'cad' };
			},
		},
		plans: PLANS,
		successUrl: 'https://acme.example/s',
		cancelUrl: 'https://acme.example/c',
		...extra,
	} as unknown as IBillingConfig;
}

const ctx = {} as IFonderieContext;

async function list(rows: unknown[], cfg = config()): Promise<IPlanDTO[]> {
	const res = await planController(storeOf(rows), cfg, new PriceCache()).list(ctx);
	return ((await res.json()) as { result: { plans: IPlanDTO[] } }).result.plans;
}

test('plans DTO: seats and features come from the configured policy when the row has none', async () => {
	const [free, starter] = await list([row('free'), row('starter')]);
	assert.equal(free!.seats, 1);
	assert.equal(starter!.seats, 5);
	assert.deepEqual(
		starter!.features.map((f) => [f.name, f.enabled, f.limit]),
		[
			['jobs', true, undefined], // null = unlimited → no limit key
			['seats', true, 5],
			['analytics', true, undefined],
		],
	);
	assert.deepEqual(
		free!.features.find((f) => f.name === 'analytics'),
		{ name: 'analytics', description: '', enabled: false },
	);
	assert.equal(free!.features.find((f) => f.name === 'jobs')!.limit, 10);
});

test("plans DTO: an operator's stored seats/features win over the policy", async () => {
	const stored = [{ name: 'custom', description: 'x', enabled: true }];
	const [, starter] = await list([row('free'), row('starter', { seats: 9, features: stored })]);
	assert.equal(starter!.seats, 9);
	assert.deepEqual(starter!.features, stored);
});

test('plans DTO: a DB-only plan (not in config) is left untouched', async () => {
	const [plan] = await list([row('legacy')]);
	assert.equal(plan!.seats, null);
	assert.deepEqual(plan!.features, []);
});

test('plans DTO: with hydration, the free plan adopts the currency all priced plans share', async () => {
	const [free, starter] = await list(
		[row('free'), row('starter')],
		config({ pricing: { hydration: true } } as Partial<IBillingConfig>),
	);
	assert.equal(starter!.pricing.currency, 'CAD');
	assert.equal(free!.pricing.currency, 'CAD');
});

test('plans DTO: without hydration the free plan keeps its default currency', async () => {
	const [free] = await list([row('free'), row('starter')]);
	assert.equal(free!.pricing.currency, 'USD');
});
