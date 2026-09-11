import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import type { IPlan, ISubscription, SubscriberType } from '../types';
import type { IBillingConfig } from '../config';
import type { IBillingProvider, IBillingEvent } from '../providers/types';

// ── Stub provider ─────────────────────────────────────────────────

function makeProvider(overrides: Partial<IBillingProvider> = {}): IBillingProvider {
	return {
		name: 'stub',

		async createCustomer() {
			return { customerId: 'cus_stub_123' };
		},

		async createCheckoutSession() {
			return { url: 'https://checkout.stub.com/session_123' };
		},

		async updateSubscription() {
			return { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() };
		},

		async resolvePriceById(priceId) {
			return {
				priceId, lookupKey: null, unitAmount: 1500n, currency: 'usd',
				interval: 'month' as const, nickname: null, productId: 'prod_stub', active: true,
			};
		},

		async resolvePricesByLookupKey() {
			return new Map();
		},

		async createPortalSession() {
			return { url: 'https://portal.stub.com/session_123' };
		},

		async constructEvent() {
			return { type: 'stub.event', subscription: null };
		},

		...overrides,
	};
}

// ── Config ────────────────────────────────────────────────────────

import { PriceCache } from '../services/price-cache';
const priceCache = new PriceCache();
const config: IBillingConfig = {
	provider: makeProvider(),
	successUrl: 'https://app.example.com/success',
	cancelUrl: 'https://app.example.com/cancel',
	plans: [
		{
			name: 'free',
			defaults: { warnAt: 0.8, buffer: 0 },
			policy: {
				'api-calls': { limit: 1_000, buffer: 100, warnAt: 0.9, window: '1d' },
				projects: { limit: 3 },
				seats: { limit: 1, warnAt: 1.0 },
				analytics: { enabled: false },
				sso: { enabled: false },
			},
		},
		{
			name: 'starter',
			trialDays: 14,
			monthly: { amount: 2900n, priceId: 'price_starter_monthly' },
			yearly: { amount: 29000n, priceId: 'price_starter_yearly' },
			defaults: { warnAt: 0.8, buffer: 0 },
			policy: {
				'api-calls': { limit: 10_000, buffer: 500, warnAt: 0.9, window: '1d' },
				projects: { limit: 10 },
				seats: { limit: 5, warnAt: 1.0 },
				analytics: { enabled: true },
				sso: { enabled: false },
			},
		},
		{
			name: 'pro',
			monthly: { amount: 7900n, priceId: 'price_pro_monthly' },
			yearly: { amount: 79000n, priceId: 'price_pro_yearly' },
			defaults: { warnAt: 0.85, buffer: 0 },
			policy: {
				'api-calls': { limit: 100_000, buffer: 5_000, warnAt: 0.9, window: '1d' },
				projects: { limit: null },
				seats: { limit: 20, warnAt: 1.0 },
				analytics: { enabled: true },
				sso: { enabled: false },
			},
		},
		{
			name: 'enterprise',
			policy: {
				'api-calls': { limit: null },
				projects: { limit: null },
				seats: { limit: null },
				analytics: { enabled: true },
				sso: { enabled: true },
			},
		},
	],
};

// ── Stub store ────────────────────────────────────────────────────

function makeStore(
	opts: { subscription?: ISubscription | null; plan?: IPlan | null } = {},
): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions') && sql.includes('SELECT')) {
				return (opts.subscription ? [opts.subscription] : []) as unknown as T[];
			}
			if (sql.includes('fonderie_plans') && sql.includes('SELECT') && opts.plan !== undefined) {
				return (opts.plan ? [opts.plan] : []) as unknown as T[];
			}
			if (sql.includes('INSERT INTO fonderie_plans') || sql.includes('UPDATE fonderie_plans')) {
				if (opts.plan === null) return [] as T[];
				const plan: IPlan = opts.plan ?? {
					id: 'plan-1',
					name: 'test',
					seats: null,
					trialDays: 0,
					monthlyAmount: null,
					monthlyPriceId: null,
					yearlyAmount: null,
					yearlyPriceId: null,
					description: null,
					tier: 0,
					features: [],
					metadata: {},
				};
				return [plan] as unknown as T[];
			}
			if (sql.includes('DELETE FROM fonderie_plans')) {
				return (opts.plan ? [{ id: opts.plan.id }] : []) as unknown as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};

	return stub;
}

const baseSubscription: ISubscription = {
	id: 'sub-1',
	subscriberType: 'workspace',
	subscriberId: 'ws-1',
	plan: 'pro',
	interval: 'month',
	status: 'active',
	providerCustomerId: 'cus_123',
	providerSubscriptionId: 'sub_provider_123',
	currentPeriodStart: '2026-05-01T00:00:00.000Z',
	currentPeriodEnd: '2026-06-01T00:00:00.000Z',
	cancelAtPeriodEnd: false,
	trialEndsAt: null,
	createdAt: '2026-05-01T00:00:00.000Z',
};

const baseUserSubscription: ISubscription = {
	...baseSubscription,
	id: 'sub-2',
	subscriberType: 'user',
	subscriberId: 'user-1',
};

const basePlan: IPlan = {
	id: 'plan-1',
	name: 'pro',
	seats: 20,
	trialDays: 0,
	monthlyAmount: 7900,
	monthlyPriceId: 'price_pro_monthly',
	yearlyAmount: 79000,
	yearlyPriceId: 'price_pro_yearly',
	description: 'Professional plan',
	tier: 2,
	features: [
		{ name: 'API Access', description: 'Standard API access', enabled: true, limit: 100000 },
	],
	metadata: { color: '#3B82F6' },
};

// ── plans (config) ────────────────────────────────────────────────

test('getPlans: returns all plans from config', async () => {
	const { getPlans } = await import('../services/plans');
	const plans = getPlans(config);
	assert.equal(plans.length, 4);
});

test('getPlanByName: finds plan case-insensitively', async () => {
	const { getPlanByName } = await import('../services/plans');
	const plan = getPlanByName('PRO', config);
	assert.equal(plan?.name, 'pro');
});

test('getPlanByName: returns null for unknown plan', async () => {
	const { getPlanByName } = await import('../services/plans');
	const plan = getPlanByName('unknown', config);
	assert.equal(plan, null);
});

// ── plans (DB CRUD) ───────────────────────────────────────────────

test('getPlanById: returns plan when found', async () => {
	const { getPlanById } = await import('../services/plans');
	const store = makeStore({ plan: basePlan });
	const plan = await getPlanById('11111111-1111-4111-8111-111111111111', store);
	assert.equal(plan?.name, 'pro');
	assert.equal(plan?.monthlyAmount, 7900);
});

test('getPlanById: returns null when not found', async () => {
	const { getPlanById } = await import('../services/plans');
	const store = makeStore({ plan: null });
	const plan = await getPlanById('22222222-2222-4222-8222-222222222222', store);
	assert.equal(plan, null);
});

test('getPlanById: returns null for a non-UUID id without querying (avoids a 22P02 500)', async () => {
	const { getPlanById } = await import('../services/plans');
	let queried = false;
	const store = {
		query: async () => {
			queried = true;
			return [] as unknown[];
		},
	} as unknown as import('@fonderie/store').IStoreAdapter;
	const plan = await getPlanById('not-a-uuid', store);
	assert.equal(plan, null);
	assert.equal(queried, false, 'a malformed id must not reach the ::uuid-typed query');
});

test('updatePlan / deletePlan: reject a non-UUID id before querying (no 22P02 500)', async () => {
	const { updatePlan, deletePlan } = await import('../services/plans');
	let queried = false;
	const store = {
		query: async () => {
			queried = true;
			return [] as unknown[];
		},
	} as unknown as import('@fonderie/store').IStoreAdapter;
	assert.equal(await updatePlan('not-a-uuid', { name: 'x' }, store), null);
	assert.equal(await deletePlan('not-a-uuid', store), false);
	assert.equal(queried, false, 'neither write reaches the ::uuid-typed query for a malformed id');
});

test('createPlan: returns created plan', async () => {
	const { createPlan } = await import('../services/plans');
	const store = makeStore({ plan: basePlan });
	const plan = await createPlan({ name: 'pro', seats: 20, monthlyAmount: 7900 }, store);
	assert.equal(plan.name, 'pro');
});

test('updatePlan: returns updated plan', async () => {
	const { updatePlan } = await import('../services/plans');
	const updated = { ...basePlan, monthlyAmount: 9900 };
	const store = makeStore({ plan: updated });
	const plan = await updatePlan('11111111-1111-4111-8111-111111111111', { monthlyAmount: 9900 }, store);
	assert.equal(plan?.monthlyAmount, 9900);
});

test('deletePlan: returns true when deleted', async () => {
	const { deletePlan } = await import('../services/plans');
	const store = makeStore({ plan: basePlan });
	const deleted = await deletePlan('11111111-1111-4111-8111-111111111111', store);
	assert.ok(deleted);
});

test('deletePlan: returns false when not found', async () => {
	const { deletePlan } = await import('../services/plans');
	const store = makeStore({ plan: null });
	const deleted = await deletePlan('22222222-2222-4222-8222-222222222222', store);
	assert.ok(!deleted);
});

// ── planController ────────────────────────────────────────────────

function makeCtx(
	params: Record<string, string> = {},
	body: Record<string, unknown> = {},
): import('@fonderie/core').IFonderieContext {
	return {
		meta: { params, body },
		user: null,
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/'),
	} as any;
}

test('planController.list: returns plans array', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.list(makeCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.ok(Array.isArray(body.result?.plans));
});

test('planController.get: returns 200 when plan found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.get(makeCtx({ planId: '11111111-1111-4111-8111-111111111111' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result?.plan.name, 'pro');
});

test('planController.get: 404 when not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.get(makeCtx({ planId: '22222222-2222-4222-8222-222222222222' }));
	assert.equal(res.status, 404);
});

test('planController.get: 400 when planId missing', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const ctrl = planController(makeStore(), config, priceCache);
	const res = await ctrl.get(makeCtx());
	assert.equal(res.status, 400);
});

test('planController.create: 201 with new plan', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.create(makeCtx({}, { name: 'pro', monthlyAmount: 7900 }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 201);
	assert.ok(body.result?.plan);
});

test('planController.create: 422 when name missing', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const ctrl = planController(makeStore(), config, priceCache);
	const res = await ctrl.create(makeCtx({}, {}));
	assert.equal(res.status, 422);
});

test('planController.update: 200 with updated plan', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: { ...basePlan, monthlyAmount: 9900 } });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.update(makeCtx({ planId: '11111111-1111-4111-8111-111111111111' }, { monthlyAmount: 9900 }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.ok(body.result?.plan);
});

test('planController.update: 404 when plan not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.update(makeCtx({ planId: '22222222-2222-4222-8222-222222222222' }, { name: 'x' }));
	assert.equal(res.status, 404);
});

test('planController.update: 422 when body is empty', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const ctrl = planController(makeStore(), config, priceCache);
	const res = await ctrl.update(makeCtx({ planId: '11111111-1111-4111-8111-111111111111' }, {}));
	assert.equal(res.status, 422);
});

test('planController.delete: 200 when deleted', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.delete(makeCtx({ planId: '11111111-1111-4111-8111-111111111111' }));
	assert.equal(res.status, 200);
});

test('planController.delete: 404 when not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.delete(makeCtx({ planId: '22222222-2222-4222-8222-222222222222' }));
	assert.equal(res.status, 404);
});

// ── subscriptions ─────────────────────────────────────────────────

test('getSubscription: returns workspace subscription when found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store = makeStore({ subscription: baseSubscription });
	const result = await getSubscription('workspace', 'ws-1', store);
	assert.equal(result?.plan, 'pro');
	assert.equal(result?.status, 'active');
	assert.equal(result?.subscriberType, 'workspace');
	assert.equal(result?.subscriberId, 'ws-1');
});

test('getSubscription: returns user subscription when found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store = makeStore({ subscription: baseUserSubscription });
	const result = await getSubscription('user', 'user-1', store);
	assert.equal(result?.subscriberType, 'user');
	assert.equal(result?.subscriberId, 'user-1');
});

test('getSubscription: returns null when not found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store = makeStore({ subscription: null });
	const result = await getSubscription('workspace', 'ws-missing', store);
	assert.equal(result, null);
});

// ── DTOs ──────────────────────────────────────────────────────────

test('toPlanDTO: maps all plan fields', async () => {
	const { toPlanDTO } = await import('../dtos/billing');
	const dto = toPlanDTO(basePlan);
	assert.equal(dto.id, basePlan.id);
	assert.equal(dto.planId, 'PRO');
	assert.equal(dto.name, basePlan.name);
	assert.equal(dto.tier, 2);
	assert.equal(dto.seats, 20);
	assert.equal(dto.trialDays, 0);
	assert.equal(dto.description, 'Professional plan');
	assert.equal(dto.pricing.monthly, 7900);
	assert.equal(dto.pricing.yearly, 79000);
	assert.equal(dto.pricing.currency, 'USD');
	assert.equal(dto.features.length, 1);
	assert.equal(dto.features[0]!.name, 'API Access');
	assert.equal(dto.metadata['color'], '#3B82F6');
});

test('toPlanDTO: free plan amounts default to 0', async () => {
	const { toPlanDTO } = await import('../dtos/billing');
	const dto = toPlanDTO({ ...basePlan, monthlyAmount: null, yearlyAmount: null });
	assert.equal(dto.pricing.monthly, 0);
	assert.equal(dto.pricing.yearly, 0);
});

test('toSubscriptionDTO: maps workspace subscription fields', async () => {
	const { toSubscriptionDTO } = await import('../dtos/billing');
	const dto = toSubscriptionDTO(baseSubscription);
	assert.equal(dto.id, baseSubscription.id);
	assert.equal(dto.subscriberType, 'workspace');
	assert.equal(dto.subscriberId, 'ws-1');
	assert.equal(dto.plan, baseSubscription.plan);
	assert.equal(dto.status, baseSubscription.status);
	assert.equal(dto.interval, baseSubscription.interval);
	assert.equal(dto.createdAt, baseSubscription.createdAt);
});

test('toSubscriptionDTO: maps user subscription fields', async () => {
	const { toSubscriptionDTO } = await import('../dtos/billing');
	const dto = toSubscriptionDTO(baseUserSubscription);
	assert.equal(dto.subscriberType, 'user');
	assert.equal(dto.subscriberId, 'user-1');
});

// ── requirePlan middleware ─────────────────────────────────────────

test('requirePlan: allows request when plan matches', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store = makeStore({ subscription: baseSubscription });
	const middleware = requirePlan('pro', store);
	let nextCalled = false;

	const ctx = {
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta: {},
		request: new Request('http://localhost/test'),
		tenant: null,
	} as any;

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

test('requirePlan: blocks request when plan does not match', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store = makeStore({ subscription: { ...baseSubscription, plan: 'free' } });
	const middleware = requirePlan(['pro', 'enterprise'], store);
	let nextCalled = false;

	const ctx = {
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta: {},
		request: new Request('http://localhost/test'),
		tenant: null,
	} as any;

	const response = await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(!nextCalled);
	assert.equal(response.status, 402);
});

test('requirePlan: blocks when subscription status is not active', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store = makeStore({
		subscription: { ...baseSubscription, plan: 'pro', status: 'past_due' },
	});
	const middleware = requirePlan('pro', store);

	const ctx = {
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta: {},
		request: new Request('http://localhost/test'),
		tenant: null,
	} as any;

	const response = await middleware(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 402);
});

test('requirePlan: allows trialing subscription', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store = makeStore({
		subscription: { ...baseSubscription, plan: 'pro', status: 'trialing' },
	});
	const middleware = requirePlan('pro', store);
	let nextCalled = false;

	const ctx = {
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta: {},
		request: new Request('http://localhost/test'),
		tenant: null,
	} as any;

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

test('requirePlan: works with user-level subscription (no workspace)', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store = makeStore({ subscription: baseUserSubscription });
	const middleware = requirePlan('pro', store);
	let nextCalled = false;

	const ctx = {
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: null,
		meta: {},
		request: new Request('http://localhost/test'),
		tenant: null,
	} as any;

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

// ── IBillingProvider interface ────────────────────────────────────

test('IBillingProvider: stub satisfies interface', () => {
	const provider = makeProvider();
	assert.ok(typeof provider.createCustomer === 'function');
	assert.ok(typeof provider.createCheckoutSession === 'function');
	assert.ok(typeof provider.createPortalSession === 'function');
	assert.ok(typeof provider.constructEvent === 'function');
});

test('IBillingProvider: createCustomer returns customerId', async () => {
	const provider = makeProvider();
	const result = await provider.createCustomer({
		email: 'a@b.com',
		subscriberType: 'workspace',
		subscriberId: 'ws-1',
		userId: 'user-1',
	});
	assert.ok(typeof result.customerId === 'string');
	assert.ok(result.customerId.length > 0);
});

test('IBillingProvider: createCheckoutSession returns url', async () => {
	const provider = makeProvider();
	const result = await provider.createCheckoutSession({
		customerId: 'cus_123',
		priceId: 'price_pro',
		subscriberType: 'workspace',
		subscriberId: 'ws-1',
		successUrl: 'https://app.com/success',
		cancelUrl: 'https://app.com/cancel',
	});
	assert.ok(typeof result.url === 'string');
	assert.ok(result.url.startsWith('https://'));
});

// ── BillingModule shape ───────────────────────────────────────────

test('BillingModule: satisfies IFonderieModule interface', async () => {
	const { BillingModule } = await import('../module');
	const store = makeStore();
	const mod = new BillingModule(store, config);

	assert.equal(mod.name, '@fonderie/billing');
	assert.ok(typeof mod.install === 'function');
});

// ── getMigrationsPath ─────────────────────────────────────────────

test('getMigrationsPath: returns a string path', async () => {
	const { getMigrationsPath } = await import('../migrations/index');
	const path = getMigrationsPath();
	assert.ok(typeof path === 'string');
	assert.ok(path.includes('migrations'));
});

// ── Policy engine ─────────────────────────────────────────────────

test('buildBillingContext: feature flag enabled', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'starter')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: {},
	});
	const status = ctx.statuses['analytics'];
	assert.ok(status?.type === 'feature');
	assert.equal(status.enabled, true);
});

test('buildBillingContext: feature flag disabled', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: {},
	});
	const status = ctx.statuses['sso'];
	assert.ok(status?.type === 'feature');
	assert.equal(status.enabled, false);
});

test('buildBillingContext: counter status ok when under limit', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { 'api-calls': 500 },
	});
	const status = ctx.statuses['api-calls'];
	assert.ok(status?.type === 'counter');
	assert.equal(status.status, 'ok');
	assert.equal(status.limit, 1_000);
	assert.equal(status.used, 500);
});

test('buildBillingContext: counter status warning when at warnAt threshold', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { 'api-calls': 950 },
	});
	const status = ctx.statuses['api-calls'];
	assert.ok(status?.type === 'counter');
	assert.equal(status.status, 'warning'); // 950 >= 1000 * 0.9
});

test('buildBillingContext: counter status over_limit when at soft limit', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { 'api-calls': 1_000 },
	});
	const status = ctx.statuses['api-calls'];
	assert.ok(status?.type === 'counter');
	assert.equal(status.status, 'over_limit');
});

test('buildBillingContext: counter status blocked when beyond hard limit', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { 'api-calls': 1_101 },
	});
	const status = ctx.statuses['api-calls'];
	assert.ok(status?.type === 'counter');
	assert.equal(status.status, 'blocked'); // 1101 >= 1000 + 100 (buffer)
});

test('buildBillingContext: unlimited counter (null limit) always ok', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'pro')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { projects: 99999 },
	});
	const status = ctx.statuses['projects'];
	assert.ok(status?.type === 'counter');
	assert.equal(status.status, 'ok');
	assert.equal(status.limit, null);
});

test('buildBillingContext: windowed counter has resetsAt', async () => {
	const { buildBillingContext } = await import('../services/policy');
	const plan = config.plans.find((p) => p.name === 'free')!;
	const ctx = buildBillingContext({
		subscriber: { type: 'user', id: 'u1' },
		plan,
		active: true,
		counters: { 'api-calls': 0 },
	});
	const status = ctx.statuses['api-calls'];
	assert.ok(status?.type === 'counter');
	assert.ok(status.resetsAt !== null);
	assert.ok(!isNaN(Date.parse(status.resetsAt!)));
});

// ── Counter backends ──────────────────────────────────────────────

test('MemoryCounterBackend: increments and returns total', async () => {
	const { MemoryCounterBackend } = await import('../backends/memory');
	const backend = new MemoryCounterBackend();
	const key = 'user:u1:api-calls';
	assert.equal(await backend.increment(key, null), 1);
	assert.equal(await backend.increment(key, null), 2);
	assert.equal(await backend.increment(key, null, 3), 5);
});

test('MemoryCounterBackend: resets after window expires', async () => {
	const { MemoryCounterBackend } = await import('../backends/memory');
	const backend = new MemoryCounterBackend();
	const key = 'user:u1:api-calls-window';
	const windowMs = 50; // 50ms test window
	await backend.increment(key, windowMs);
	await backend.increment(key, windowMs);
	assert.equal(await backend.get(key, windowMs), 2);
	await new Promise((r) => setTimeout(r, 60));
	assert.equal(await backend.get(key, windowMs), 0); // expired
});

test('MemoryCounterBackend: get returns 0 for unknown key', async () => {
	const { MemoryCounterBackend } = await import('../backends/memory');
	const backend = new MemoryCounterBackend();
	assert.equal(await backend.get('unknown:key', null), 0);
});

// ── Helpers ───────────────────────────────────────────────────────

test('hasFeature: returns true for enabled feature', async () => {
	const { hasFeature } = await import('../helpers');
	const ctx: any = {
		meta: {
			billing: {
				plan: 'starter',
				active: true,
				subscriber: { type: 'user', id: 'u1' },
				statuses: { analytics: { type: 'feature', enabled: true } },
			},
		},
	};
	assert.equal(hasFeature(ctx, 'analytics'), true);
});

test('hasFeature: returns false for disabled feature', async () => {
	const { hasFeature } = await import('../helpers');
	const ctx: any = {
		meta: {
			billing: {
				plan: 'free',
				active: true,
				subscriber: { type: 'user', id: 'u1' },
				statuses: { sso: { type: 'feature', enabled: false } },
			},
		},
	};
	assert.equal(hasFeature(ctx, 'sso'), false);
});

test('hasFeature: returns true when no billing context (fail-open)', async () => {
	const { hasFeature } = await import('../helpers');
	const ctx: any = { meta: {} };
	assert.equal(hasFeature(ctx, 'any-feature'), true);
});

test('getPlanLimit: returns limit for counter entry', async () => {
	const { getPlanLimit } = await import('../helpers');
	const ctx: any = {
		meta: {
			billing: {
				plan: 'free',
				active: true,
				subscriber: { type: 'user', id: 'u1' },
				statuses: {
					projects: { type: 'counter', limit: 3, used: 1, status: 'ok', resetsAt: null },
				},
			},
		},
	};
	assert.equal(getPlanLimit(ctx, 'projects'), 3);
});

test('getPlanLimit: returns null when no billing context', async () => {
	const { getPlanLimit } = await import('../helpers');
	const ctx: any = { meta: {} };
	assert.equal(getPlanLimit(ctx, 'projects'), null);
});

test('requireFeature: passes when feature enabled', async () => {
	const { requireFeature } = await import('../helpers');
	const middleware = requireFeature('analytics');
	const ctx: any = {
		meta: {
			billing: {
				plan: 'starter',
				active: true,
				subscriber: { type: 'user', id: 'u1' },
				statuses: { analytics: { type: 'feature', enabled: true } },
			},
		},
	};
	let called = false;
	await middleware(ctx, async () => {
		called = true;
		return new Response();
	});
	assert.ok(called);
});

test('requireFeature: blocks when feature disabled', async () => {
	const { requireFeature } = await import('../helpers');
	const middleware = requireFeature('sso');
	const ctx: any = {
		meta: {
			billing: {
				plan: 'free',
				active: true,
				subscriber: { type: 'user', id: 'u1' },
				statuses: { sso: { type: 'feature', enabled: false } },
			},
		},
	};
	let called = false;
	const res = await middleware(ctx, async () => {
		called = true;
		return new Response();
	});
	assert.ok(!called);
	assert.equal(res.status, 402);
});

// ── BillingInterval derivation ────────────────────────────────────

test('BILLING_INTERVALS drives the type, the guard, and the checkout schema', async () => {
	const { BILLING_INTERVAL, BILLING_INTERVALS, isBillingInterval } = await import('../types');
	const { checkoutSchema } = await import('../schemas');

	// Object and tuple carry the same values (the satisfies clause pins this
	// at compile time; assert it at runtime too).
	assert.deepEqual([...BILLING_INTERVALS].sort(), Object.values(BILLING_INTERVAL).sort());

	assert.equal(isBillingInterval('month'), true);
	assert.equal(isBillingInterval('year'), true);
	assert.equal(isBillingInterval('week'), false);
	assert.equal(isBillingInterval(undefined), false);

	// The schema is derived, not a duplicated literal list.
	assert.equal(checkoutSchema.safeParse({ plan: 'pro', interval: 'year' }).success, true);
	assert.equal(checkoutSchema.safeParse({ plan: 'pro', interval: 'week' }).success, false);
});

test('toBillingInterval: passes intervals through and falls back to month for unsupported ones', async () => {
	const { toBillingInterval } = await import('../providers/stripe');
	assert.equal(toBillingInterval('year'), 'year');
	assert.equal(toBillingInterval('month'), 'month');
	// Historical fallback, now explicit: day/week Stripe prices record as month.
	assert.equal(toBillingInterval('week'), 'month');
	assert.equal(toBillingInterval(undefined), 'month');
});

test('checkoutController: rejects an interval outside BILLING_INTERVALS', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const ctrl = checkoutController(makeStore(), config);
	const ctx = {
		meta: { body: { plan: 'pro', interval: 'week' } },
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing/checkout'),
	} as any;
	const res = await ctrl.createSession(ctx);
	assert.equal(res.status, 422);
});

// ── parseWindowMs ─────────────────────────────────────────────────

test('parseWindowMs: parses day window', async () => {
	const { parseWindowMs } = await import('../utils');
	assert.equal(parseWindowMs('1d'), 86_400_000);
	assert.equal(parseWindowMs('30d'), 30 * 86_400_000);
});

test('parseWindowMs: parses hour window', async () => {
	const { parseWindowMs } = await import('../utils');
	assert.equal(parseWindowMs('1h'), 3_600_000);
	assert.equal(parseWindowMs('24h'), 86_400_000);
});

// ── pricing hydration (kill-switch + cache) ───────────────────────

const priced = (id: string) => ({
	priceId: id, lookupKey: null, unitAmount: 1500n, currency: 'usd',
	interval: 'month' as const, nickname: null, productId: 'p', active: true,
});

test('planController.list: hydrates amount/currency from provider when enabled', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, { ...config, pricing: { hydration: true } }, new PriceCache());
	const body = (await (await ctrl.list(makeCtx())).json()) as any;
	assert.equal(body.result.plans[0].pricing.monthly, 1500); // live price, not basePlan's 7900
	assert.equal(body.result.plans[0].pricing.currency, 'USD');
});

test('planController.list: uses hardcoded amount/currency when hydration off', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, new PriceCache()); // no pricing.hydration
	const body = (await (await ctrl.list(makeCtx())).json()) as any;
	assert.equal(body.result.plans[0].pricing.monthly, 7900); // fallback
});

test('PriceCache: single-flight dedupes concurrent misses', async () => {
	let calls = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => { calls++; return priced(id); } });
	const cache = new PriceCache();
	await Promise.all([
		cache.byPriceId('price_x', provider),
		cache.byPriceId('price_x', provider),
		cache.byPriceId('price_x', provider),
	]);
	assert.equal(calls, 1);
});

test('PriceCache: serves last-cached on transient miss within grace', async () => {
	let n = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => (++n === 1 ? priced(id) : null) });
	const cache = new PriceCache({ ttlMs: 0 }); // force re-resolve each call
	const first = await cache.byPriceId('price_y', provider);
	assert.equal(first.price?.unitAmount, 1500n);
	const second = await cache.byPriceId('price_y', provider); // provider now returns null
	assert.equal(second.price?.unitAmount, 1500n); // served from cache
	assert.equal(second.stale, true);
});

// ── webhook: dual-mapping (§16.3) + cache invalidation (§8) ────────

const webhookCtx = (body: string): any => ({
	request: new Request('http://localhost/webhook', {
		method: 'POST',
		headers: { 'stripe-signature': 't=1,v1=stub' },
		body,
	}),
	meta: {},
});

const normalizedSub = (over: Record<string, unknown> = {}) => ({
	subscriberType: 'workspace' as const, subscriberId: 'ws-1',
	plan: 'wrong-nickname', priceLookupKey: null, priceId: null,
	status: 'active', interval: 'month' as const,
	providerCustomerId: 'cus', providerSubscriptionId: 'sub',
	currentPeriodStart: new Date(), currentPeriodEnd: new Date(),
	cancelAtPeriodEnd: false, trialEndsAt: null,
	...over,
});

function captureStore(): { store: IStoreAdapter; plan: () => string | undefined } {
	let capturedPlan: string | undefined;
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions') && !sql.trimStart().startsWith('SELECT')) {
				capturedPlan = params?.[2] as string; // (subscriber_type, subscriber_id, plan, …)
				return [{ applied: 1 }] as T[]; // upsert applied (ordering guard passed)
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, plan: () => capturedPlan };
}

test('webhook: maps plan from priceId (dual-mapping), not the nickname', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const cap = captureStore();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_pro_monthly' }) as any,
		}),
	});
	const ctrl = webhookController(cap.store, { ...config, provider, webhookSecret: 'whsec_x' });
	const res = await ctrl.handle(webhookCtx('{}'));
	assert.equal(res.status, 200);
	assert.equal(cap.plan(), 'pro'); // resolved from price_pro_monthly, not 'wrong-nickname'
});

test('webhook: deletion stays free/canceled (dual-mapping not applied)', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const cap = captureStore();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.deleted',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', plan: 'free', status: 'canceled' }) as any,
		}),
	});
	const ctrl = webhookController(cap.store, { ...config, provider, webhookSecret: 'whsec_x' });
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(cap.plan(), 'free'); // NOT re-mapped to 'pro'
});

test('webhook: price.updated invalidates the price cache (§8)', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const cache = new PriceCache();
	let invalidated = false;
	const orig = cache.invalidate.bind(cache);
	cache.invalidate = (k?: string) => { invalidated = true; orig(k); };
	const provider = makeProvider({
		constructEvent: async () => ({ type: 'price.updated', subscription: null }),
	});
	const ctrl = webhookController(captureStore().store, { ...config, provider, webhookSecret: 'whsec_x' }, cache);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(invalidated, true);
});

test('resolvePlanNameByPrice: lookup_key wins, then priceId, else null', async () => {
	const { resolvePlanNameByPrice } = await import('../services/plans');
	const plans = config.plans;
	assert.equal(resolvePlanNameByPrice({ lookupKey: null, priceId: 'price_pro_monthly' }, plans), 'pro');
	assert.equal(resolvePlanNameByPrice({ lookupKey: null, priceId: 'price_starter_yearly' }, plans), 'starter');
	assert.equal(resolvePlanNameByPrice({ lookupKey: null, priceId: 'price_unknown' }, plans), null);
});

// ── PriceCache edge cases ─────────────────────────────────────────

test('PriceCache: fresh hit does not re-call provider within TTL', async () => {
	let calls = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => { calls++; return priced(id); } });
	const cache = new PriceCache({ ttlMs: 60_000 });
	await cache.byPriceId('p', provider);
	const second = await cache.byPriceId('p', provider);
	assert.equal(calls, 1);
	assert.equal(second.stale, false);
});

test('PriceCache: transient miss beyond grace returns null', async () => {
	let n = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => (++n === 1 ? priced(id) : null) });
	const cache = new PriceCache({ ttlMs: 0, graceMs: 0 });
	await cache.byPriceId('p', provider);
	const r = await cache.byPriceId('p', provider);
	assert.equal(r.price, null);
	assert.equal(r.stale, true);
});

test('PriceCache: provider outage serves last-cached within maxStale', async () => {
	let n = 0;
	const provider = makeProvider({
		resolvePriceById: async (id) => { if (++n > 1) throw new Error('stripe down'); return priced(id); },
	});
	const cache = new PriceCache({ ttlMs: 0, maxStaleMs: 60_000 });
	await cache.byPriceId('p', provider);
	const r = await cache.byPriceId('p', provider);
	assert.equal(r.price?.unitAmount, 1500n);
	assert.equal(r.stale, true);
});

test('PriceCache: provider outage beyond maxStale returns null', async () => {
	let n = 0;
	const provider = makeProvider({
		resolvePriceById: async (id) => { if (++n > 1) throw new Error('down'); return priced(id); },
	});
	const cache = new PriceCache({ ttlMs: 0, maxStaleMs: 0 });
	await cache.byPriceId('p', provider);
	const r = await cache.byPriceId('p', provider);
	assert.equal(r.price, null);
});

test('PriceCache: invalidate forces re-resolution', async () => {
	let calls = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => { calls++; return priced(id); } });
	const cache = new PriceCache({ ttlMs: 60_000 });
	await cache.byPriceId('p', provider);
	cache.invalidate('p');
	await cache.byPriceId('p', provider);
	assert.equal(calls, 2);
});

test('PriceCache: prime warms the cache without a provider call', async () => {
	let calls = 0;
	const provider = makeProvider({ resolvePriceById: async (id) => { calls++; return priced(id); } });
	const cache = new PriceCache({ ttlMs: 60_000 });
	cache.prime([priced('p')]);
	const r = await cache.byPriceId('p', provider);
	assert.equal(calls, 0);
	assert.equal(r.price?.unitAmount, 1500n);
});

// ── hydration edge cases ──────────────────────────────────────────

test('hydration: currency mismatch flags pricingStale and keeps fallback (no throw)', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const provider = makeProvider({
		resolvePriceById: async (id) => ({ ...priced(id), currency: id.includes('yearly') ? 'eur' : 'usd' }),
	});
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, { ...config, provider, pricing: { hydration: true } }, new PriceCache());
	const body = (await (await ctrl.list(makeCtx())).json()) as any;
	const pro = body.result.plans[0];
	assert.equal(pro.pricingStale, true);
	assert.equal(pro.pricing.monthly, 7900); // fallback retained, not partially applied
});

test('hydration: plan without priceIds is left untouched', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const freePlan = { ...basePlan, name: 'free', monthlyPriceId: null, yearlyPriceId: null, monthlyAmount: 0, yearlyAmount: 0 };
	const store = makeStore({ plan: freePlan });
	const ctrl = planController(store, { ...config, pricing: { hydration: true } }, new PriceCache());
	const body = (await (await ctrl.list(makeCtx())).json()) as any;
	assert.equal(body.result.plans[0].pricing.monthly, 0);
	assert.equal(body.result.plans[0].pricingStale, undefined);
});

// ── attribution edge cases ────────────────────────────────────────

test('resolvePlanNameByPrice: lookup_key wins over a conflicting priceId', async () => {
	const { resolvePlanNameByPrice } = await import('../services/plans');
	const plans: any = [
		{ name: 'a', monthly: { lookupKey: 'k_pro', priceId: 'price_x' } },
		{ name: 'b', monthly: { priceId: 'price_y' } },
	];
	assert.equal(resolvePlanNameByPrice({ lookupKey: 'k_pro', priceId: 'price_y' }, plans), 'a');
});

test('webhook: falls back to nickname when price matches no config plan', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const cap = captureStore();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_unmatched', plan: 'legacy-nick' }) as any,
		}),
	});
	const ctrl = webhookController(cap.store, { ...config, provider, webhookSecret: 'whsec_x' });
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(cap.plan(), 'legacy-nick');
});

// ── DTO date honesty (docs/DTO-GAP-AUDIT.md, billing batch) ───────

test('toSubscriptionDTO: serializes pg Date rows as ISO strings, not accidental toJSON', async () => {
	const { toSubscriptionDTO } = await import('../dtos/billing');
	const at = new Date('2026-05-01T00:00:00.000Z');
	const dto = toSubscriptionDTO({
		...baseSubscription,
		currentPeriodStart: at,
		currentPeriodEnd: at,
		trialEndsAt: at,
		createdAt: at,
	} as never);
	assert.equal(dto.currentPeriodStart, '2026-05-01T00:00:00.000Z');
	assert.equal(dto.currentPeriodEnd, '2026-05-01T00:00:00.000Z');
	assert.equal(dto.trialEndsAt, '2026-05-01T00:00:00.000Z');
	assert.equal(dto.createdAt, '2026-05-01T00:00:00.000Z');
	// Nullables stay null, not ''.
	const bare = toSubscriptionDTO({ ...baseSubscription, trialEndsAt: null } as never);
	assert.equal(bare.trialEndsAt, null);
});

test('usageController.get: since is an explicit ISO string on the wire', async () => {
	const { usageController } = await import('../controllers/usage.controller');
	const ctrl = usageController(makeStore());
	const ctx = {
		meta: { params: { metric: 'api-calls' } },
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing/usage/api-calls'),
	} as any;
	const res = await ctrl.get(ctx);
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(typeof body.result.since, 'string');
	assert.equal(new Date(body.result.since).toISOString(), body.result.since);
});

// ── domain events (Phase 1): subscription lifecycle on the bus ────

function recordingBus() {
	const calls: { type: string; payload: any }[] = [];
	return {
		bus: { emit: async (type: string, payload: unknown) => { calls.push({ type, payload }); } } as any,
		calls,
	};
}

test('webhook: emits the subscription lifecycle domain event with workspaceId', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { EVENT_KEYS } = await import('../config');
	const cases: Array<[string, string, string]> = [
		// [provider event type, status override, expected EVENT_KEY]
		['customer.subscription.created', 'active', EVENT_KEYS.subscriptionCreated],
		['customer.subscription.updated', 'active', EVENT_KEYS.subscriptionUpdated],
		['customer.subscription.updated', 'past_due', EVENT_KEYS.subscriptionPastDue],
		['customer.subscription.deleted', 'canceled', EVENT_KEYS.subscriptionCanceled],
	];
	for (const [type, status, expected] of cases) {
		const { bus, calls } = recordingBus();
		const provider = makeProvider({
			constructEvent: async () => ({
				type,
				subscription: normalizedSub({ priceId: 'price_pro_monthly', status }) as any,
			}),
		});
		const ctrl = webhookController(captureStore().store, { ...config, provider, webhookSecret: 'whsec_x' }, undefined, bus);
		await ctrl.handle(webhookCtx('{}'));
		assert.equal(calls.length, 1, `${type}/${status} should emit once`);
		assert.equal(calls[0]!.type, expected);
		assert.equal(calls[0]!.payload.subscriberType, 'workspace');
		assert.equal(calls[0]!.payload.workspaceId, 'ws-1', 'workspace subscriber carries top-level workspaceId (webhooks fan-out contract)');
		assert.equal(calls[0]!.payload.status, status);
	}
});

test('webhook: a stale/out-of-order subscription event fires NO lifecycle event or notice', async () => {
	// The DB ordering guard rejects the stale upsert (returns not-applied). The
	// controller must then skip the lifecycle domain event AND the customer notice
	// — otherwise a downstream consumer acting on subscriptionUpdated:active would
	// resurrect the cancellation through the event bus.
	const { webhookController } = await import('../controllers/webhook.controller');
	const { bus, calls } = recordingBus();
	// Store whose ordering guard REJECTS the write: the upsert RETURNING yields no row.
	const staleStore: IStoreAdapter = {
		query: async <T = unknown>(): Promise<T[]> => [] as T[],
		transaction: async (fn) => fn(staleStore),
	};
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'active' }) as any,
			eventAt: new Date('2020-01-01T00:00:00Z'), // ancient → the guard rejects it
		}),
	});
	const ctrl = webhookController(staleStore, { ...config, provider, webhookSecret: 'whsec_x' }, undefined, bus);
	const res = await ctrl.handle(webhookCtx('{}'));
	const body = (await res.json()) as any;
	assert.equal(body.ignored, 'stale-subscription-event');
	assert.equal(calls.length, 0, 'a stale retry emits neither a lifecycle event nor a customer notice');
});

test('webhook: a user subscriber emits no top-level workspaceId', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ subscriberType: 'user', subscriberId: 'user-1', priceId: 'price_pro_monthly' }) as any,
		}),
	});
	const ctrl = webhookController(captureStore().store, { ...config, provider, webhookSecret: 'whsec_x' }, undefined, bus);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(calls[0]!.payload.subscriberType, 'user');
	assert.equal('workspaceId' in calls[0]!.payload, false);
});

test('webhook: no bus configured → no throw, still 200', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_pro_monthly' }) as any,
		}),
	});
	const ctrl = webhookController(captureStore().store, { ...config, provider, webhookSecret: 'whsec_x' });
	const res = await ctrl.handle(webhookCtx('{}'));
	assert.equal(res.status, 200);
});

// ── communication integrity (Phase 2): subscriber notifications ────
//
// The subscription webhook sends a customer-facing NOTIFICATION_EVENT (the
// outer emit type) only on the transition INTO past_due / canceled, so a
// provider re-delivery does not re-email. The durable domain event still
// fires every time (asserted above).

// A store whose subscription SELECT returns a row in `status`, so the
// controller sees a prior state; the upsert reports applied (ordering guard
// passed) so the lifecycle event + transition notice run.
function priorSubStore(status: string | null): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) {
				if (sql.trimStart().startsWith('SELECT')) {
					return (status === null ? [] : [{ status }]) as T[];
				}
				return [{ applied: 1 }] as T[]; // upsert applied
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return store;
}

const withRecipient = (over: Partial<IBillingConfig> = {}): IBillingConfig =>
	({ ...config, resolveRecipient: () => ({ email: 'buyer@example.com' }), ...over }) as IBillingConfig;

test('webhook: a fresh past_due transition sends a payment-failed notice once', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { MESSAGE_KEYS } = await import('../config');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'past_due' }) as any,
		}),
	});
	const ctrl = webhookController(
		priorSubStore('active'), // was active → now past_due: a real transition
		withRecipient({ provider, webhookSecret: 'whsec_x' }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	const notices = calls.filter((c) => c.type === NOTIFICATION_EVENT);
	assert.equal(notices.length, 1, 'exactly one customer notice');
	assert.equal(notices[0]!.payload.type, MESSAGE_KEYS.paymentFailed);
	assert.equal(notices[0]!.payload.recipient.email, 'buyer@example.com');
	assert.equal(notices[0]!.payload.data.plan, 'pro');
});

test('webhook: a re-delivered past_due while already past_due sends no repeat notice', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.updated',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'past_due' }) as any,
		}),
	});
	const ctrl = webhookController(
		priorSubStore('past_due'), // already past_due: not a transition
		withRecipient({ provider, webhookSecret: 'whsec_x' }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(calls.filter((c) => c.type === NOTIFICATION_EVENT).length, 0, 'no repeat notice');
	assert.ok(calls.length >= 1, 'the durable domain event still fires every time');
});

test('webhook: a cancellation sends a subscription-canceled notice', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { MESSAGE_KEYS } = await import('../config');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.deleted',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', plan: 'free', status: 'canceled' }) as any,
		}),
	});
	const ctrl = webhookController(
		priorSubStore('active'),
		withRecipient({ provider, webhookSecret: 'whsec_x' }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	const notices = calls.filter((c) => c.type === NOTIFICATION_EVENT);
	assert.equal(notices.length, 1);
	assert.equal(notices[0]!.payload.type, MESSAGE_KEYS.subscriptionCanceled);
});

test('webhook: without resolveRecipient, no notice is sent (only the domain event)', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.deleted',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', plan: 'free', status: 'canceled' }) as any,
		}),
	});
	// Base config has no resolveRecipient.
	const ctrl = webhookController(priorSubStore('active'), { ...config, provider, webhookSecret: 'whsec_x' }, undefined, bus);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(calls.filter((c) => c.type === NOTIFICATION_EVENT).length, 0);
});

// ── Phase 3b: invoice (renewal receipt / dunning) + trial-ending ──

// A store that resolves a subscriber for the invoice→subscription lookup.
function subByProviderStore(sub: { subscriberType: string; subscriberId: string } | null): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('provider_subscription_id = $1')) return (sub ? [sub] : []) as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return store;
}

test('webhook: invoice.paid sends a renewal receipt', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'invoice.paid',
			subscription: null,
			invoice: { id: 'in_1', status: 'paid', amount: 1999n, currency: 'usd', providerTxId: 'pi_1', providerSubscriptionId: 'sub_1', providerCustomerId: 'cus_1', metadata: {} },
		}),
	});
	const ctrl = webhookController(
		subByProviderStore({ subscriberType: 'workspace', subscriberId: 'ws-1' }),
		withRecipient({ provider, webhookSecret: 'whsec_x' }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(calls.filter((c) => c.type === EVENT_KEYS.invoicePaid).length, 1);
	const notices = calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.renewalReceipt);
	assert.equal(notices.length, 1);
	assert.equal(notices[0]!.payload.data.amount, '1999');
});

test('webhook: invoice.payment_failed emits an event but NO notice (past_due owns the dunning email)', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { EVENT_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'invoice.payment_failed',
			subscription: null,
			invoice: { id: 'in_2', status: 'payment_failed', amount: 2500n, currency: 'usd', providerTxId: 'pi_2', providerSubscriptionId: 'sub_1', providerCustomerId: null, metadata: {} },
		}),
	});
	const ctrl = webhookController(
		subByProviderStore({ subscriberType: 'workspace', subscriberId: 'ws-1' }),
		withRecipient({ provider, webhookSecret: 'whsec_x' }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(calls.filter((c) => c.type === EVENT_KEYS.invoicePaymentFailed).length, 1);
	assert.equal(calls.filter((c) => c.type === NOTIFICATION_EVENT).length, 0, 'no double-dun here');
});

test('webhook: invoice for an unknown subscription is acknowledged and ignored', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'invoice.paid',
			subscription: null,
			invoice: { id: 'in_3', status: 'paid', amount: 100n, currency: 'usd', providerTxId: null, providerSubscriptionId: 'sub_unknown', providerCustomerId: null, metadata: {} },
		}),
	});
	const ctrl = webhookController(subByProviderStore(null), withRecipient({ provider, webhookSecret: 'whsec_x' }));
	const res = await ctrl.handle(webhookCtx('{}'));
	assert.equal(((await res.json()) as any).ignored, 'no-matching-subscription');
});

test('webhook: trial_will_end sends a trial-ending notice without upserting the subscription', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const cap = captureStore();
	// nickname is the legacy 'wrong-nickname'; the plan must resolve from priceId.
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.trial_will_end',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'trialing' }),
		}),
	});
	const ctrl = webhookController(cap.store, withRecipient({ provider, webhookSecret: 'whsec_x' }), undefined, bus);
	await ctrl.handle(webhookCtx('{}'));
	const events = calls.filter((c) => c.type === EVENT_KEYS.subscriptionTrialWillEnd);
	assert.equal(events.length, 1);
	assert.equal(events[0]!.payload.plan, 'pro', 'plan resolved from priceId, not the nickname');
	const notices = calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.trialEnding);
	assert.equal(notices.length, 1);
	assert.equal(notices[0]!.payload.data.plan, 'pro');
	assert.equal(cap.plan(), undefined, 'a trial-ending heads-up must not upsert subscription state');
});

test('webhook: notifications.trialEnding=false suppresses the EMAIL but keeps the domain event', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'customer.subscription.trial_will_end',
			subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'trialing' }),
		}),
	});
	const ctrl = webhookController(
		captureStore().store,
		withRecipient({ provider, webhookSecret: 'whsec_x', notifications: { trialEnding: false } }),
		undefined,
		bus,
	);
	await ctrl.handle(webhookCtx('{}'));
	assert.equal(
		calls.filter((c) => c.type === EVENT_KEYS.subscriptionTrialWillEnd).length,
		1,
		'the durable domain event still fires',
	);
	assert.equal(
		calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.trialEnding).length,
		0,
		'the reminder email is suppressed by the toggle',
	);
});

// ── Phase 4: first-party cancel / reactivate ──────────────────────

function lifecycleProvider(): { provider: IBillingProvider; calls: { cancel?: any; reactivate?: any } } {
	const calls: { cancel?: any; reactivate?: any } = {};
	const provider = makeProvider({
		async cancelSubscription(opts: any) {
			calls.cancel = opts;
			return {
				status: opts.atPeriodEnd ? 'active' : 'canceled',
				cancelAtPeriodEnd: opts.atPeriodEnd,
				currentPeriodEnd: new Date(1_700_000_000_000),
			};
		},
		async reactivateSubscription(opts: any) {
			calls.reactivate = opts;
			return { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: new Date(1_700_000_000_000) };
		},
	});
	return { provider, calls };
}

function subCtrlStore(sub: unknown, applied = true): { store: IStoreAdapter; upserts: unknown[][] } {
	const upserts: unknown[][] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) {
				if (sql.trimStart().startsWith('SELECT')) return (sub ? [sub] : []) as T[];
				upserts.push(params ?? []);
				// applied=false simulates the ON CONFLICT ... WHERE guard rejecting the
				// write (RETURNING yields no row) — e.g. an optimistic reactivate/cancel
				// landing after a terminal deleted webhook already canceled the row.
				return (applied ? [{ applied: 1 }] : []) as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, upserts };
}

function subCtx(body: Record<string, unknown> = {}): import('@fonderie/core').IFonderieContext {
	return {
		meta: { body },
		user: { id: 'u1', email: 'a@b.com' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/'),
	} as any;
}

const activeSub = {
	subscriberType: 'user', subscriberId: 'u1', plan: 'starter', interval: 'month',
	status: 'active', providerCustomerId: 'cus_1', providerSubscriptionId: 'sub_1', cancelAtPeriodEnd: false,
	currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
	currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
	trialEndsAt: new Date('2026-09-08T00:00:00Z'),
};

test('subscription.cancel: at period end (default) flags cancellation and preserves period/trial fields', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store, upserts } = subCtrlStore(activeSub);
	const res = await subscriptionController(store, { ...config, provider }).cancel(subCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(calls.cancel.atPeriodEnd, true);
	assert.equal(calls.cancel.subscriptionId, 'sub_1');
	assert.equal(body.result.atPeriodEnd, true);
	// [7]=currentPeriodStart [8]=currentPeriodEnd [9]=cancelAtPeriodEnd [10]=trialEndsAt
	assert.equal(upserts[0]![9], true, 'stored cancelAtPeriodEnd = true');
	assert.ok(upserts[0]![7], 'currentPeriodStart preserved (not nulled)');
	assert.ok(upserts[0]![10], 'trialEndsAt preserved (not nulled)');
});

test('subscription.cancel: immediate (atPeriodEnd:false) does NOT optimistically write status (webhook owns the notice)', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store, upserts } = subCtrlStore(activeSub);
	const res = await subscriptionController(store, { ...config, provider }).cancel(subCtx({ atPeriodEnd: false }));
	const body = (await res.json()) as any;
	assert.equal(calls.cancel.atPeriodEnd, false);
	assert.equal(body.result.status, 'canceled');
	assert.equal(upserts.length, 0, 'no optimistic canceled-status write — the deleted webhook owns the transition + notice');
});

test('subscription.cancel: an already-canceled subscription is a no-op (no provider call)', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store, upserts } = subCtrlStore({ ...activeSub, status: 'canceled', cancelAtPeriodEnd: false });
	const res = await subscriptionController(store, { ...config, provider }).cancel(subCtx());
	assert.equal(res.status, 200);
	assert.equal(calls.cancel, undefined, 'provider not re-hit on an already-canceled subscription');
	assert.equal(upserts.length, 0);
});

test('subscription.cancel: 501 when the provider has no cancelSubscription', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { store } = subCtrlStore(activeSub);
	const res = await subscriptionController(store, { ...config, provider: makeProvider() }).cancel(subCtx());
	assert.equal(res.status, 501);
});

test('subscription.cancel: 404 when there is no subscription', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider } = lifecycleProvider();
	const { store } = subCtrlStore(null);
	const res = await subscriptionController(store, { ...config, provider }).cancel(subCtx());
	assert.equal(res.status, 404);
});

test('subscription.reactivate: un-cancels and clears cancelAtPeriodEnd', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store, upserts } = subCtrlStore({ ...activeSub, cancelAtPeriodEnd: true });
	const res = await subscriptionController(store, { ...config, provider }).reactivate(subCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(calls.reactivate.subscriptionId, 'sub_1');
	assert.equal(body.result.cancelAtPeriodEnd, false);
	assert.equal(upserts[0]![9], false, 'stored cancelAtPeriodEnd = false');
});

test('subscription.reactivate: 501 when the provider has no reactivateSubscription', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { store } = subCtrlStore({ ...activeSub, cancelAtPeriodEnd: true });
	const res = await subscriptionController(store, { ...config, provider: makeProvider() }).reactivate(subCtx());
	assert.equal(res.status, 501);
});

test('subscription.reactivate: 409 for a fully-canceled subscription (no provider call)', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store } = subCtrlStore({ ...activeSub, status: 'canceled' });
	const res = await subscriptionController(store, { ...config, provider }).reactivate(subCtx());
	assert.equal(res.status, 409);
	assert.equal(calls.reactivate, undefined, 'provider not called for a canceled subscription');
});

test('subscription.reactivate: a terminal deleted webhook mid-request → guard no-ops the write → 409, NOT a phantom reactivation', async () => {
	// The read saw an active/scheduled-to-cancel row (so the line-150 guard passes
	// and the provider is called), but by the time the optimistic write lands the
	// deleted webhook has canceled the row. The guarded upsert returns not-applied;
	// the controller must report the truthful terminal state, not "reactivated".
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider, calls } = lifecycleProvider();
	const { store, upserts } = subCtrlStore({ ...activeSub, cancelAtPeriodEnd: true }, false);
	const res = await subscriptionController(store, { ...config, provider }).reactivate(subCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 409);
	assert.equal(body.reason, 'SUBSCRIPTION_CANCELED');
	assert.ok(calls.reactivate, 'provider WAS called (the read looked reactivatable)');
	// the guarded write was attempted and carried the terminal guard flag
	assert.equal(upserts.length, 1, 'the optimistic write was attempted (and guard-rejected)');
});

test('subscription.cancel (atPeriodEnd): a terminal deleted webhook mid-request → guard no-ops → already-canceled 200, NOT a phantom scheduled-cancel', async () => {
	const { subscriptionController } = await import('../controllers/subscription.controller');
	const { provider } = lifecycleProvider();
	const { store } = subCtrlStore(activeSub, false);
	const res = await subscriptionController(store, { ...config, provider }).cancel(subCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.reason, 'SUBSCRIPTION_CANCELED');
	assert.equal(body.result.status, 'canceled', 'reports the truthful terminal state');
	assert.equal(body.result.atPeriodEnd, false);
});

test('buildBillingRoutes: registers first-party cancel + reactivate', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const paths = buildBillingRoutes(subCtrlStore(null).store, config).map(([m, p]) => `${m} ${p}`);
	assert.ok(paths.includes('POST /billing/subscription/cancel'));
	assert.ok(paths.includes('POST /billing/subscription/reactivate'));
});

test('buildBillingRoutes: plan-write routes are gated on config.planAdminToken', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const store = subCtrlStore(null).store;

	// No token → the write routes are NOT registered (404); GET stays public.
	const open = buildBillingRoutes(store, config).map(([m, p]) => `${m} ${p}`);
	assert.ok(open.includes('GET /plans'), 'GET /plans stays public');
	assert.ok(!open.includes('POST /plans'), 'POST /plans not registered without a token');
	assert.ok(!open.includes('PUT /plans/:planId'));
	assert.ok(!open.includes('DELETE /plans/:planId'));

	// With a token → the write routes register (guarded by requireAdminToken).
	const guarded = buildBillingRoutes(store, { ...config, planAdminToken: 'ops-secret' } as typeof config);
	const guardedPaths = guarded.map(([m, p]) => `${m} ${p}`);
	assert.ok(guardedPaths.includes('POST /plans'));
	assert.ok(guardedPaths.includes('PUT /plans/:planId'));
	assert.ok(guardedPaths.includes('DELETE /plans/:planId'));
	// The POST /plans chain carries an auth middleware before the handler.
	const postPlans = guarded.find(([m, p]) => m === 'POST' && p === '/plans')!;
	assert.ok(postPlans.length >= 4, 'POST /plans has requireAdminToken + validate + handler');
});

test('buildBillingRoutes: unified config.adminToken guards BOTH plan writes and wallet grant', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const store = subCtrlStore(null).store;
	// Wallet must be configured for the grant route to be in scope at all.
	const withWallet = { ...config, wallet: { currency: 'USD' } } as unknown as IBillingConfig;

	// One unified token enables both ops surfaces.
	const unified = buildBillingRoutes(store, { ...withWallet, adminToken: 'one-token' } as IBillingConfig)
		.map(([m, p]) => `${m} ${p}`);
	assert.ok(unified.includes('POST /plans'), 'plan writes enabled by config.adminToken');
	assert.ok(unified.includes('POST /billing/wallet/grant'), 'wallet grant enabled by config.adminToken');

	// Neither token → neither ops route exists.
	const none = buildBillingRoutes(store, withWallet).map(([m, p]) => `${m} ${p}`);
	assert.ok(!none.includes('POST /plans'));
	assert.ok(!none.includes('POST /billing/wallet/grant'));

	// Legacy fields still work as fallbacks (deprecated, non-breaking).
	const legacyPlan = buildBillingRoutes(store, { ...withWallet, planAdminToken: 'legacy' } as IBillingConfig)
		.map(([m, p]) => `${m} ${p}`);
	assert.ok(legacyPlan.includes('POST /plans'), 'deprecated planAdminToken still enables plan writes');
	assert.ok(!legacyPlan.includes('POST /billing/wallet/grant'), 'plan token does not enable wallet grant');

	const legacyWallet = buildBillingRoutes(store, {
		...config,
		wallet: { currency: 'USD', adminToken: 'legacy-wallet' },
	} as unknown as IBillingConfig).map(([m, p]) => `${m} ${p}`);
	assert.ok(legacyWallet.includes('POST /billing/wallet/grant'), 'deprecated wallet.adminToken still enables grant');
	assert.ok(!legacyWallet.includes('POST /plans'), 'wallet token does not enable plan writes');
});

// ── Phase 4b: upgrade in place (Claude-style), downgrade via cancel+resubscribe ──

function tieredCheckout(): { config: IBillingConfig; calls: { update?: any } } {
	const calls: { update?: any } = {};
	const provider = makeProvider({
		async updateSubscription(opts: any) {
			calls.update = opts;
			return { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() };
		},
	});
	const cfg = {
		provider,
		successUrl: 'https://app.example.com/s',
		cancelUrl: 'https://app.example.com/c',
		plans: [
			{ name: 'starter', tier: 1, monthly: { priceId: 'price_starter_monthly' }, yearly: { priceId: 'price_starter_yearly' } },
			{ name: 'pro', tier: 2, monthly: { priceId: 'price_pro_monthly' }, yearly: { priceId: 'price_pro_yearly' } },
		],
	} as IBillingConfig;
	return { config: cfg, calls };
}

function checkoutCtx(body: Record<string, unknown>): import('@fonderie/core').IFonderieContext {
	return {
		meta: { body },
		user: { id: 'u1', email: 'a@b.com' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing/checkout'),
	} as any;
}

const proSub = { ...baseSubscription, plan: 'pro', subscriberType: 'user', subscriberId: 'u1', providerSubscriptionId: 'sub_1', providerCustomerId: 'cus_1' };
const starterSub = { ...proSub, plan: 'starter' };

const proYearSub = { ...proSub, interval: 'year' };
const starterYearSub = { ...proSub, plan: 'starter', interval: 'year' };
const canceledPro = { ...proSub, status: 'canceled' };
const pastDueStarter = { ...starterSub, status: 'past_due' };
const scheduledStarter = { ...starterSub, cancelAtPeriodEnd: true, trialEndsAt: '2026-09-08T00:00:00.000Z' };

test('checkout: a downgrade is NOT done in place — it requires cancel + resubscribe (PLAN_CHANGE_REQUIRES_CANCEL)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const ctrl = checkoutController(makeStore({ subscription: proSub as any }), cfg);
	const res = await ctrl.createSession(checkoutCtx({ plan: 'starter', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'PLAN_CHANGE_REQUIRES_CANCEL');
	assert.equal(body.details.reason, 'downgrade_requires_cancel');
	assert.equal(calls.update, undefined, 'no provider mutation — the plan is not changed in place');
});

test('checkout: upgrade invoices the difference immediately (always_invoice) — Claude-style', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const ctrl = checkoutController(makeStore({ subscription: starterSub as any }), cfg);
	const res = await ctrl.createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result.upgraded, true);
	assert.equal(calls.update.prorationBehavior, 'always_invoice');
	assert.equal(calls.update.priceId, 'price_pro_monthly');
});

test('checkout: a no-op (same plan + interval) is rejected (PLAN_UNCHANGED)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const ctrl = checkoutController(makeStore({ subscription: proSub as any }), cfg);
	const res = await ctrl.createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'PLAN_UNCHANGED');
	assert.equal(calls.update, undefined, 'no provider change on a no-op switch');
});

test('checkout: a same-plan month→year switch is treated as an upgrade (immediate charge)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const { store } = subCtrlStore(proSub); // pro / month
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'year' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result.upgraded, true, 'month→year is an upgrade, charged immediately');
	assert.equal(calls.update.prorationBehavior, 'always_invoice');
	assert.equal(calls.update.priceId, 'price_pro_yearly');
});

test('checkout: a year→month switch on the same plan requires cancel + resubscribe', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const { store } = subCtrlStore(proYearSub); // pro / year
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'PLAN_CHANGE_REQUIRES_CANCEL');
	assert.equal(calls.update, undefined, 'year→month is a downgrade in commitment — not done in place');
});

test('checkout: a year→month switch to a HIGHER tier is still blocked (no prepaid-annual-to-credit leak)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const { store } = subCtrlStore(starterYearSub); // starter / year (tier 1)
	// Tier rises (pro=2) but the interval drops year→month: must NOT be an in-place
	// upgrade, or Stripe would credit the unused prepaid annual value.
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'PLAN_CHANGE_REQUIRES_CANCEL');
	assert.equal(calls.update, undefined, 'interval guard runs before tier — year→month never upgrades in place');
});

test('checkout: a higher-tier but CHEAPER plan (same interval) is not an in-place upgrade (price backstop)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const calls: { update?: any } = {};
	const provider = makeProvider({
		async updateSubscription(opts: any) {
			calls.update = opts;
			return { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() };
		},
	});
	// tier says premium(2) > standard(1), but premium is priced BELOW standard —
	// a mis-ordered tier. The amount backstop must refuse the in-place change.
	const cfg = {
		provider,
		successUrl: 'https://x/s',
		cancelUrl: 'https://x/c',
		plans: [
			{ name: 'standard', tier: 1, monthly: { priceId: 'price_standard_monthly', amount: 2000n } },
			{ name: 'premium', tier: 2, monthly: { priceId: 'price_premium_monthly', amount: 1000n } },
		],
	} as IBillingConfig;
	const onStandard = { ...proSub, plan: 'standard' };
	const res = await checkoutController(subCtrlStore(onStandard).store, cfg).createSession(
		checkoutCtx({ plan: 'premium', interval: 'month' }),
	);
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'PLAN_CHANGE_REQUIRES_CANCEL');
	assert.equal(calls.update, undefined, 'cheaper target at the same interval is never an in-place upgrade');
});

test('checkout: a past_due subscriber cannot change plans in place (SUBSCRIPTION_PAST_DUE)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const res = await checkoutController(subCtrlStore(pastDueStarter).store, cfg).createSession(
		checkoutCtx({ plan: 'pro', interval: 'month' }),
	);
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'SUBSCRIPTION_PAST_DUE');
	assert.equal(calls.update, undefined, 'no plan change while a balance is unpaid');
});

test('checkout: an UNPAID subscriber cannot change plans in place, and is NOT orphaned (SUBSCRIPTION_PAST_DUE)', async () => {
	// unpaid still exists at the provider. It must be refused like past_due —
	// never fall through to a fresh checkout that nulls provider_subscription_id.
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const { store, upserts } = subCtrlStore({ ...starterSub, status: 'unpaid' });
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'SUBSCRIPTION_PAST_DUE');
	assert.equal(calls.update, undefined, 'no plan change while a balance is unpaid');
	assert.equal(upserts.length, 0, 'the live provider subscription is NOT orphaned by a fresh checkout');
});

test('checkout: a PAUSED subscriber must resume before changing plans, and is NOT orphaned (SUBSCRIPTION_PAUSED)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	const { store, upserts } = subCtrlStore({ ...starterSub, status: 'paused' });
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'SUBSCRIPTION_PAUSED');
	assert.equal(calls.update, undefined, 'no in-place change onto a paused subscription');
	assert.equal(upserts.length, 0, 'the paused provider subscription is NOT orphaned by a fresh checkout');
});

test('checkout: a scheduled-to-cancel subscriber must reactivate before upgrading (SUBSCRIPTION_SCHEDULED_TO_CANCEL)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	// Otherwise the paid upgrade would still be deleted at period end.
	const res = await checkoutController(subCtrlStore(scheduledStarter).store, cfg).createSession(
		checkoutCtx({ plan: 'pro', interval: 'month' }),
	);
	const body = (await res.json()) as any;
	assert.equal(res.status, 422);
	assert.equal(body.reason, 'SUBSCRIPTION_SCHEDULED_TO_CANCEL');
	assert.equal(calls.update, undefined, 'reactivate first — do not charge an upgrade onto a canceling sub');
});

test('checkout: an untiered plan change is NOT done in place (requires cancel + resubscribe)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const calls: { update?: any } = {};
	const provider = makeProvider({
		async updateSubscription(opts: any) {
			calls.update = opts;
			return { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() };
		},
	});
	const untiered = {
		provider,
		successUrl: 'https://x/s',
		cancelUrl: 'https://x/c',
		plans: [
			{ name: 'basic', monthly: { priceId: 'price_basic_monthly' } },
			{ name: 'plus', monthly: { priceId: 'price_plus_monthly' } },
		],
	} as IBillingConfig;
	const onBasic = { ...proSub, plan: 'basic' };
	const res = await checkoutController(subCtrlStore(onBasic).store, untiered).createSession(
		checkoutCtx({ plan: 'plus', interval: 'month' }),
	);
	const body = (await res.json()) as any;
	assert.equal(res.status, 422, 'untiered pair cannot be ranked — never changed in place');
	assert.equal(body.reason, 'PLAN_CHANGE_REQUIRES_CANCEL');
	assert.equal(calls.update, undefined);
});

test('checkout: a CANCELED subscriber can subscribe to a lower-tier plan (fresh checkout — the sanctioned downgrade path)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = tieredCheckout();
	// Was on pro, now canceled (membership ended). Choosing the lower plan now
	// opens a brand-new checkout, NOT an in-place change: the existing customer is
	// reused (saved card survives) and the dead subscription id is cleared.
	const { store, upserts } = subCtrlStore(canceledPro);
	const res = await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'starter', interval: 'month' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.reason, 'CHECKOUT_URL');
	assert.ok(body.result.url, 'a fresh checkout session is returned');
	assert.equal(calls.update, undefined, 'no in-place mutation — a canceled sub resubscribes fresh');
	// upsert params: [4]=status [5]=providerCustomerId [6]=providerSubscriptionId
	assert.equal(upserts[0]![4], 'incomplete');
	assert.equal(upserts[0]![5], 'cus_1', 'existing provider customer reused (card/auto-recharge preserved)');
	assert.equal(upserts[0]![6], null, 'dead provider subscription id cleared (not retained via COALESCE)');
});

// A store for the trial-eligibility tests: no current subscription (so checkout
// takes the fresh-checkout branch), and the trials ledger reports consumed or not.
function trialStore(consumed: boolean): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscription_trials')) {
				return (sql.trimStart().startsWith('SELECT') && consumed ? [{ one: 1 }] : []) as T[];
			}
			if (sql.includes('fonderie_subscriptions')) {
				return (sql.trimStart().startsWith('SELECT') ? [] : [{ applied: 1 }]) as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return store;
}

function trialCheckoutConfig(): { config: IBillingConfig; calls: { session?: any } } {
	const calls: { session?: any } = {};
	const provider = makeProvider({
		async createCustomer() {
			return { customerId: 'cus_new' };
		},
		async createCheckoutSession(opts: any) {
			calls.session = opts;
			return { url: 'https://x/pay', sessionId: 'cs_1' };
		},
	});
	const config = {
		provider,
		successUrl: 'https://x/s',
		cancelUrl: 'https://x/c',
		plans: [{ name: 'pro', monthly: { priceId: 'price_pro_monthly' }, trialDays: 14 }],
	} as IBillingConfig;
	return { config, calls };
}

test('checkout: a first-time subscriber gets the plan trial (trialDays applied)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = trialCheckoutConfig();
	const res = await checkoutController(trialStore(false), cfg).createSession(
		checkoutCtx({ plan: 'pro', interval: 'month' }),
	);
	assert.equal(res.status, 200);
	assert.equal(calls.session.trialDays, 14, 'a never-trialed subscriber gets the trial');
});

test('checkout: a subscriber who already consumed a trial gets NO new trial (farming blocked)', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg, calls } = trialCheckoutConfig();
	const res = await checkoutController(trialStore(true), cfg).createSession(
		checkoutCtx({ plan: 'pro', interval: 'month' }),
	);
	assert.equal(res.status, 200);
	assert.equal(calls.session.trialDays, undefined, 'a returning trialer is not granted another trial');
});

test('webhook: a subscription carrying a trial records it as consumed (farming guard); no trial → no record', async () => {
	const { webhookController } = await import('../controllers/webhook.controller');
	const drive = async (trialEndsAt: Date | null) => {
		const inserts: string[] = [];
		const store: IStoreAdapter = {
			query: async <T = unknown>(sql: string): Promise<T[]> => {
				if (sql.includes('fonderie_subscription_trials')) {
					if (!sql.trimStart().startsWith('SELECT')) inserts.push('mark');
					return [] as T[];
				}
				if (sql.includes('fonderie_subscriptions')) {
					return (sql.trimStart().startsWith('SELECT') ? [] : [{ applied: 1 }]) as T[];
				}
				return [] as T[];
			},
			transaction: async (fn) => fn(store),
		};
		const provider = makeProvider({
			constructEvent: async () => ({
				type: 'customer.subscription.created',
				subscription: normalizedSub({ priceId: 'price_pro_monthly', status: 'trialing', trialEndsAt }) as any,
			}),
		});
		await webhookController(store, { ...config, provider, webhookSecret: 'whsec_x' }, undefined, recordingBus().bus).handle(
			webhookCtx('{}'),
		);
		return inserts.length;
	};
	assert.equal(await drive(new Date('2026-10-01T00:00:00Z')), 1, 'a trialing subscription is recorded as consumed');
	assert.equal(await drive(null), 0, 'a non-trial subscription records nothing');
});

test('checkout: an in-place UPGRADE clears any pending cancellation and carries the trial forward', async () => {
	const { checkoutController } = await import('../controllers/checkout.controller');
	const { config: cfg } = tieredCheckout();
	// Active, NOT scheduled to cancel, mid-trial. Upgrading keeps the trial and
	// writes cancelAtPeriodEnd=false (a re-commitment, never a lingering cancel).
	const trialing = { ...starterSub, cancelAtPeriodEnd: false, trialEndsAt: '2026-09-08T00:00:00.000Z' };
	const { store, upserts } = subCtrlStore(trialing);
	await checkoutController(store, cfg).createSession(checkoutCtx({ plan: 'pro', interval: 'month' }));
	// upsert params: [9]=cancelAtPeriodEnd [10]=trialEndsAt
	assert.equal(upserts[0]![9], false, 'cancelAtPeriodEnd written false on upgrade');
	assert.ok(upserts[0]![10], 'trialEndsAt carried forward (not nulled)');
});

// ── in-app payment method: setup / save / remove ──────────────────

// A Map-backed fonderie_wallet_customers emulator for the account controller:
// SELECT (getWalletCustomer), INSERT (upsertWalletCustomer), and the
// payment_method_id UPDATE (setWalletCustomerCard). No subscription rows.
function pmStore(seed: { customerId?: string; card?: string | null } = {}): {
	store: IStoreAdapter
	state: { customerId: string | null; card: string | null }
} {
	const state = { customerId: seed.customerId ?? null, card: seed.card ?? null }
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_wallet_customers')) {
				const t = sql.trimStart()
				if (t.startsWith('SELECT')) {
					return (state.customerId
						? [{ providerCustomerId: state.customerId, paymentMethodId: state.card }]
						: []) as T[]
				}
				if (t.startsWith('INSERT')) {
					// upsertWalletCustomer: [st, sid, provider, providerCustomerId, rearm, pm]
					state.customerId = (params?.[3] as string) ?? state.customerId
					return [] as T[]
				}
				if (sql.includes('payment_method_id = $4')) {
					// setWalletCustomerCard: [st, sid, provider, pm|null]
					state.card = (params?.[3] as string | null) ?? null
					return [] as T[]
				}
				return [] as T[]
			}
			if (sql.includes('fonderie_subscriptions')) return [] as T[]
			return [] as T[]
		},
		transaction: async (fn) => fn(store),
	}
	return { store, state }
}

test('account.setupPaymentMethod: creates a customer and returns a SetupIntent client secret', async () => {
	const { accountController } = await import('../controllers/account.controller')
	const calls: any = {}
	const provider = makeProvider({
		async createCustomer() {
			calls.created = true
			return { customerId: 'cus_new' }
		},
		async createSetupIntent(o: any) {
			calls.setup = o
			return { clientSecret: 'seti_secret_123', setupIntentId: 'seti_1' }
		},
	})
	const { store, state } = pmStore()
	const res = await accountController(store, ({ ...config, wallet: { currency: 'USD', precision: 2 }, provider }) as IBillingConfig).setupPaymentMethod(subCtx())
	const body = (await res.json()) as any
	assert.equal(res.status, 200)
	assert.equal(body.result.clientSecret, 'seti_secret_123')
	assert.equal(calls.created, true, 'a customer was created for the pay-as-you-go user')
	assert.equal(calls.setup.customerId, 'cus_new')
	assert.equal(state.customerId, 'cus_new', 'customer recorded so later reads resolve it')
})

test('account.savePaymentMethod: sets default, records the card, returns it', async () => {
	const { accountController } = await import('../controllers/account.controller')
	const calls: any = {}
	const provider = makeProvider({
		async setDefaultPaymentMethod(o: any) {
			calls.def = o
		},
		async getPaymentMethod() {
			return { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030, fingerprint: 'fp_1' }
		},
	})
	const { store, state } = pmStore({ customerId: 'cus_1' })
	const res = await accountController(store, ({ ...config, wallet: { currency: 'USD', precision: 2 }, provider }) as IBillingConfig).savePaymentMethod(
		subCtx({ paymentMethodId: 'pm_1' }),
	)
	const body = (await res.json()) as any
	assert.equal(res.status, 200)
	assert.equal(calls.def.customerId, 'cus_1')
	assert.equal(calls.def.paymentMethodId, 'pm_1')
	assert.equal(body.result.paymentMethod.last4, '4242')
	assert.equal('fingerprint' in body.result.paymentMethod, false, 'server-side signal never on the wire')
	assert.equal(state.card, 'pm_1', 'consented card recorded')
})

test('account.savePaymentMethod: a card not attached to the customer is rejected (422)', async () => {
	const { accountController } = await import('../controllers/account.controller')
	const provider = makeProvider({
		async setDefaultPaymentMethod() {
			throw new Error('not attached to this customer')
		},
	})
	const { store, state } = pmStore({ customerId: 'cus_1' })
	const res = await accountController(store, ({ ...config, wallet: { currency: 'USD', precision: 2 }, provider }) as IBillingConfig).savePaymentMethod(
		subCtx({ paymentMethodId: 'pm_someone_else' }),
	)
	const body = (await res.json()) as any
	assert.equal(res.status, 422)
	assert.equal(body.reason, 'INVALID_PAYMENT_METHOD')
	assert.equal(state.card, null, 'nothing recorded on rejection')
})

test('account.removePaymentMethod: detaches and clears the recorded card', async () => {
	const { accountController } = await import('../controllers/account.controller')
	const calls: any = {}
	const provider = makeProvider({
		async detachPaymentMethod(o: any) {
			calls.detach = o
		},
	})
	const { store, state } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const res = await accountController(store, ({ ...config, wallet: { currency: 'USD', precision: 2 }, provider }) as IBillingConfig).removePaymentMethod(subCtx())
	const body = (await res.json()) as any
	assert.equal(res.status, 200)
	assert.equal(calls.detach.paymentMethodId, 'pm_1')
	assert.equal(body.result.paymentMethod, null)
	assert.equal(state.card, null, 'record cleared')
})

test('account payment-method mutations: 501 when the provider lacks support', async () => {
	const { accountController } = await import('../controllers/account.controller')
	const { store } = pmStore({ customerId: 'cus_1' })
	const ctrl = accountController(store, ({
		...config,
		wallet: { currency: 'USD', precision: 2 },
		provider: makeProvider(),
	}) as IBillingConfig)
	assert.equal((await ctrl.setupPaymentMethod(subCtx())).status, 501)
	assert.equal((await ctrl.savePaymentMethod(subCtx({ paymentMethodId: 'pm_1' }))).status, 501)
	assert.equal((await ctrl.removePaymentMethod(subCtx())).status, 501)
})

// ── In-app purchase (charge saved card) ───────────────────────────
// Branch logic only — the outcomes that DON'T credit (so no ledger SQL). The
// credited + idempotency path runs against real Postgres in integration.test.ts.

function purchaseConfig(provider: IBillingProvider): IBillingConfig {
	return {
		...config,
		provider,
		wallet: {
			currency: 'USD',
			precision: 2,
			creditPacks: [{ id: 'small', name: 'Small pack', credits: 5000n, priceAmount: 499n }],
		},
	} as IBillingConfig
}

const purchaseArgs = (store: IStoreAdapter, config: IBillingConfig, extra: Record<string, unknown> = {}) => ({
	store,
	config,
	bus: undefined,
	subscriberType: 'user' as SubscriberType,
	subscriberId: 'user-1',
	packId: 'small',
	creditCurrency: 'USD',
	precision: 2,
	idempotencyKey: 'attempt-1',
	...extra,
})

test('purchase: unknown packId resolves to invalid_pack (no charge)', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	let charged = false
	const provider = makeProvider({ chargeOffSession: async () => { charged = true; return { providerTxId: 'pi', status: 'succeeded' } } })
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider), { packId: 'nope' }))
	assert.equal(out.status, 'invalid_pack')
	assert.equal(charged, false, 'never charge for an unknown pack')
})

test('purchase: no saved card → checkout_required (fall back to hosted checkout)', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const provider = makeProvider({ chargeOffSession: async () => ({ providerTxId: 'pi', status: 'succeeded' }) })
	const { store } = pmStore() // no customer / no card
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.deepEqual(out, { status: 'checkout_required', reason: 'no_saved_card' })
})

test('purchase: provider without chargeOffSession → checkout_required', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const provider = makeProvider() // no chargeOffSession
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.deepEqual(out, { status: 'checkout_required', reason: 'no_saved_card' })
})

test('purchase: SCA required → checkout_required(authentication_required), never credits', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const provider = makeProvider({ chargeOffSession: async () => ({ providerTxId: 'pi_ra', status: 'requires_action' }) })
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.deepEqual(out, { status: 'checkout_required', reason: 'authentication_required' })
})

test('purchase: indeterminate charge → processing (retry same key, NOT a checkout fallback)', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const provider = makeProvider({ chargeOffSession: async () => ({ providerTxId: null, status: 'unknown' }) })
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	// MUST NOT be checkout_required — falling back to a new hosted payment could double-charge.
	assert.equal(out.status, 'processing')
})

test('purchase: definitive decline → declined', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const provider = makeProvider({ chargeOffSession: async () => ({ providerTxId: null, status: 'failed' }) })
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.equal(out.status, 'declined')
})

test('purchase: passes the consented card + a purchase-scoped idempotency key to the charge', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	let seen: any = null
	const provider = makeProvider({ chargeOffSession: async (o: any) => { seen = o; return { providerTxId: null, status: 'failed' } } })
	const { store } = pmStore({ customerId: 'cus_9', card: 'pm_9' })
	await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider), { idempotencyKey: 'k-42' }))
	assert.equal(seen.customerId, 'cus_9')
	assert.equal(seen.paymentMethodId, 'pm_9')
	assert.equal(seen.idempotencyKey, 'stub:purchase:user:user-1:k-42', 'charge key is purchase-scoped + subscriber-namespaced + client key (double-submit safe, no cross-subscriber collision)')
	assert.equal(seen.metadata.reason, 'purchase')
	assert.equal(seen.amount, 499n)
})

// ── In-app purchase: webhook safety-net + failure suppression ─────

test('normalizePaymentIntentSucceeded: bare PI maps to a paid payment keyed by PI id', async () => {
	const { normalizePaymentIntentSucceeded } = await import('../providers/stripe')
	const p = normalizePaymentIntentSucceeded({
		id: 'pi_abc',
		amount: 499,
		currency: 'usd',
		customer: 'cus_1',
		metadata: { reason: 'purchase', packId: 'small', credits: '5000', subscriberType: 'user', subscriberId: 'u1', currency: 'USD' },
	} as any)
	assert.equal(p.providerTxId, 'pi_abc')
	assert.equal(p.sessionId, 'pi_abc', 'no session — PI id stands in')
	assert.equal(p.paymentStatus, 'paid')
	assert.equal(p.customerId, 'cus_1')
	assert.equal(p.amountTotal, 499n)
	assert.equal(p.metadata.reason, 'purchase')
})

test('payment webhook: a declined in-app purchase (reason:purchase) sends NO payment-failed notice', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller')
	const { bus, calls } = recordingBus()
	const provider = makeProvider({
		constructEvent: async () => ({
			type: 'payment_intent.payment_failed',
			subscription: null,
			paymentFailure: {
				sessionId: null,
				providerTxId: 'pi_declined',
				amount: 499n,
				currency: 'usd',
				reason: 'card_declined',
				metadata: { reason: 'purchase', subscriberType: 'user', subscriberId: 'u1', packId: 'small' },
			},
		}),
	})
	const cfg = { ...config, provider, wallet: { currency: 'USD', precision: 2, webhookSecret: 'whsec_x', creditPacks: [] } } as IBillingConfig
	const ctrl = paymentWebhookController(makeStore(), cfg, bus)
	const res = await ctrl.handle(webhookCtx('{}'))
	const body = (await res.json()) as any
	assert.equal(body.ignored, 'purchase-handled-elsewhere', 'the interactive caller owns the decline UX')
	assert.equal(calls.length, 0, 'no payment.failed event → no duplicate customer email')
})

test('purchase: prefers chargeViaInvoice over chargeOffSession, maps requires_action → checkout', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const calls: string[] = []
	const provider = makeProvider({
		chargeViaInvoice: async () => { calls.push('invoice'); return { status: 'requires_action', providerTxId: null, invoiceId: null, invoiceNumber: null, hostedInvoiceUrl: null, invoicePdf: null } },
		chargeOffSession: async () => { calls.push('charge'); return { providerTxId: 'pi', status: 'succeeded' } },
	})
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.deepEqual(calls, ['invoice'], 'invoice path preferred; off-session not called')
	assert.deepEqual(out, { status: 'checkout_required', reason: 'authentication_required' })
})

test('purchase: falls back to chargeOffSession when the provider has no chargeViaInvoice', async () => {
	const { purchasePackWithSavedCard } = await import('../services/purchase')
	const calls: string[] = []
	const provider = makeProvider({
		chargeOffSession: async () => { calls.push('charge'); return { providerTxId: null, status: 'failed' } },
	})
	const { store } = pmStore({ customerId: 'cus_1', card: 'pm_1' })
	const out = await purchasePackWithSavedCard(purchaseArgs(store, purchaseConfig(provider)))
	assert.deepEqual(calls, ['charge'])
	assert.equal(out.status, 'declined')
})

// ── Security: manager gate on money-mutating routes (M1) ─────────────
// withBilling verifies MEMBERSHIP; spending the workspace's card, cancelling
// its subscription, or buying credits are MANAGER actions — the owner or a
// holder of an active system role.

function billingCtx(opts: {
	userId?: string | null;
	workspaceHeader?: string;
}): import('@fonderie/core').IFonderieContext {
	return {
		meta: {},
		user: opts.userId ? ({ id: opts.userId, email: 'a@b.com' } as never) : null,
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing/checkout', {
			headers: opts.workspaceHeader ? { 'x-workspace-id': opts.workspaceHeader } : {},
		}),
	} as any;
}

function managerGateStore(isManager: boolean) {
	const stub = {
		query: async (sql: string) => {
			if (sql.includes('fonderie_workspaces') && sql.includes('owner_id')) {
				return isManager ? [{ ok: 1 }] : [];
			}
			return [];
		},
		transaction: async (fn: (tx: unknown) => unknown) => fn(stub),
	};
	return stub as unknown as import('@fonderie/store').IStoreAdapter;
}

test('requireBillingManager: user-scoped billing passes (own money)', async () => {
	const { requireBillingManager } = await import('../middlewares/require-manager');
	const mw = requireBillingManager(managerGateStore(false), config);
	let called = false;
	await mw(billingCtx({ userId: 'u-1' }), async () => { called = true; return new Response(); });
	assert.ok(called);
});

test('requireBillingManager: workspace member without manager rights gets 403', async () => {
	const { requireBillingManager } = await import('../middlewares/require-manager');
	const mw = requireBillingManager(managerGateStore(false), config);
	const res = await mw(
		billingCtx({ userId: 'u-1', workspaceHeader: 'ws-1' }),
		async () => new Response(),
	);
	assert.equal(res.status, 403);
	const body = (await res.json()) as any;
	assert.equal(body.reason, 'MANAGER_REQUIRED');
});

test('requireBillingManager: owner/admin of the workspace passes', async () => {
	const { requireBillingManager } = await import('../middlewares/require-manager');
	const mw = requireBillingManager(managerGateStore(true), config);
	let called = false;
	await mw(
		billingCtx({ userId: 'u-1', workspaceHeader: 'ws-1' }),
		async () => { called = true; return new Response(); },
	);
	assert.ok(called);
});

test('requireBillingManager: management "any-member" opts out', async () => {
	const { requireBillingManager } = await import('../middlewares/require-manager');
	const mw = requireBillingManager(managerGateStore(false), { ...config, management: 'any-member' });
	let called = false;
	await mw(
		billingCtx({ userId: 'u-1', workspaceHeader: 'ws-1' }),
		async () => { called = true; return new Response(); },
	);
	assert.ok(called);
});

test('buildBillingRoutes: money mutations carry the manager gate, reads do not', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const stub: any = { query: async () => [], transaction: async (fn: any) => fn(stub) };
	const routes = buildBillingRoutes(stub, config);
	const chain = (method: string, path: string) => routes.find(([m, p]) => m === method && p === path)!;
	// checkout: [m, p, requireAuth, manager, validate, handler] — one more than
	// the read-only subscription GET's [m, p, requireAuth, handler].
	assert.equal(chain('POST', '/billing/checkout').length, 6);
	assert.equal(chain('GET', '/billing/subscription').length, 4);
	assert.equal(chain('DELETE', '/billing/payment-method').length, 5, 'card removal is manager-gated');
	assert.equal(chain('GET', '/billing/invoices').length, 4, 'invoice read is not');
});

test('isWorkspaceManager: matches system-role NAMES (GUEST must not manage money)', async () => {
	const { isWorkspaceManager } = await import('../services/membership');
	let captured: unknown[] = [];
	const store = {
		query: async (_sql: string, params?: unknown[]) => { captured = params ?? []; return []; },
		transaction: async (fn: (tx: unknown) => unknown) => fn(store),
	} as unknown as import('@fonderie/store').IStoreAdapter;
	const ok = await isWorkspaceManager('u-guest', 'ws-1', store);
	assert.equal(ok, false);
	assert.deepEqual(captured[2], ['ADMIN'], 'default manager list is ADMIN only');
});
