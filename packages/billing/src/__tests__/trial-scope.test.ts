import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { checkoutController } from '../controllers/checkout.controller';
import { checkoutSchema } from '../schemas';

// Per-workspace billing makes every new workspace a new subscriber, so the
// per-subscriber trial ledger alone lets one owner farm a trial per workspace.
// trialScope 'owner' closes that; skipTrial declines a trial for one checkout.

const WS_A = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
const WS_B = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';
const OWNER_1 = 'u-owner-1';
const OWNER_2 = 'u-owner-2';

interface World {
	// workspace id → owner id
	workspaces: Record<string, string>;
	// subscriber ids (workspace or user) that consumed a trial
	trials: Set<string>;
}

// A fake store that answers the two trial-ledger reads from `world`.
function store(world: World): IStoreAdapter {
	const s: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
			const q = sql.trimStart();
			if (q.startsWith('SELECT') && sql.includes('fonderie_subscription_trials')) {
				if (sql.includes('fonderie_workspaces')) {
					const owner = world.workspaces[params[0] as string];
					const hit = Object.entries(world.workspaces).some(
						([ws, o]) => o === owner && world.trials.has(ws),
					);
					return (owner && hit ? [{ one: 1 }] : []) as T[];
				}
				return (world.trials.has(params[1] as string) ? [{ one: 1 }] : []) as T[];
			}
			if (sql.includes('fonderie_subscriptions')) {
				return (q.startsWith('SELECT') ? [] : [{ applied: 1 }]) as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(s),
	};
	return s;
}

function setup(trialScope?: 'subscriber' | 'owner') {
	const calls: { session?: { trialDays?: number } } = {};
	const config = {
		provider: {
			name: 'stub',
			async createCustomer() {
				return { customerId: 'cus_new' };
			},
			async createCheckoutSession(opts: { trialDays?: number }) {
				calls.session = opts;
				return { url: 'https://acme.example/pay', sessionId: 'cs_1' };
			},
		},
		successUrl: 'https://acme.example/s',
		cancelUrl: 'https://acme.example/c',
		plans: [{ name: 'pro', monthly: { priceId: 'price_pro_monthly' }, trialDays: 14 }],
		...(trialScope ? { trialScope } : {}),
	} as unknown as IBillingConfig;
	return { config, calls };
}

function wsCtx(workspaceId: string, body: Record<string, unknown> = {}): IFonderieContext {
	return {
		meta: { body: { plan: 'pro', interval: 'month', ...body } },
		user: { id: 'u-caller', email: 'owner@acme.example' },
		workspace: { id: workspaceId },
		tenant: null,
		request: new Request('http://localhost/billing/checkout'),
	} as unknown as IFonderieContext;
}

async function trialDaysFor(
	world: World,
	workspaceId: string,
	trialScope?: 'subscriber' | 'owner',
	body?: Record<string, unknown>,
) {
	const { config, calls } = setup(trialScope);
	const res = await checkoutController(store(world), config).createSession(wsCtx(workspaceId, body));
	assert.equal(res.status, 200);
	return calls.session?.trialDays;
}

test("trialScope 'owner': the owner's second workspace gets NO trial", async () => {
	const world = { workspaces: { [WS_A]: OWNER_1, [WS_B]: OWNER_1 }, trials: new Set([WS_A]) };
	assert.equal(await trialDaysFor(world, WS_B, 'owner'), undefined);
});

test("trialScope 'owner': a different owner's workspace still gets the trial", async () => {
	const world = { workspaces: { [WS_A]: OWNER_1, [WS_B]: OWNER_2 }, trials: new Set([WS_A]) };
	assert.equal(await trialDaysFor(world, WS_B, 'owner'), 14);
});

test("trialScope 'owner': an owner who never trialed gets the trial", async () => {
	const world = { workspaces: { [WS_A]: OWNER_1, [WS_B]: OWNER_1 }, trials: new Set<string>() };
	assert.equal(await trialDaysFor(world, WS_B, 'owner'), 14);
});

test("default trialScope ('subscriber') keeps today's behaviour: a second workspace gets a trial", async () => {
	const world = { workspaces: { [WS_A]: OWNER_1, [WS_B]: OWNER_1 }, trials: new Set([WS_A]) };
	assert.equal(await trialDaysFor(world, WS_B), 14);
	// …and the workspace that consumed one still gets none.
	assert.equal(await trialDaysFor(world, WS_A), undefined);
});

test('skipTrial: a never-trialed subscriber who declines gets a paid checkout (no trialDays)', async () => {
	const world = { workspaces: { [WS_A]: OWNER_1 }, trials: new Set<string>() };
	assert.equal(await trialDaysFor(world, WS_A, 'owner', { skipTrial: true }), undefined);
	assert.equal(await trialDaysFor(world, WS_A, undefined, { skipTrial: true }), undefined);
	// Only a literal true declines — a stringly 'true' is not an opt-out.
	assert.equal(await trialDaysFor(world, WS_A, undefined, { skipTrial: 'true' }), 14);
});

test('checkoutSchema keeps skipTrial (validate() would strip an unknown key)', () => {
	const parsed = checkoutSchema.parse({ plan: 'pro', skipTrial: true });
	assert.equal(parsed.skipTrial, true);
	assert.equal(checkoutSchema.safeParse({ plan: 'pro', skipTrial: 'yes' }).success, false);
});
