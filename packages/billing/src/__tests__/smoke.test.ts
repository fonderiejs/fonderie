import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import type { IPlan, ISubscription } from '../types';
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
	const plan = await getPlanById('plan-1', store);
	assert.equal(plan?.name, 'pro');
	assert.equal(plan?.monthlyAmount, 7900);
});

test('getPlanById: returns null when not found', async () => {
	const { getPlanById } = await import('../services/plans');
	const store = makeStore({ plan: null });
	const plan = await getPlanById('missing', store);
	assert.equal(plan, null);
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
	const plan = await updatePlan('plan-1', { monthlyAmount: 9900 }, store);
	assert.equal(plan?.monthlyAmount, 9900);
});

test('deletePlan: returns true when deleted', async () => {
	const { deletePlan } = await import('../services/plans');
	const store = makeStore({ plan: basePlan });
	const deleted = await deletePlan('plan-1', store);
	assert.ok(deleted);
});

test('deletePlan: returns false when not found', async () => {
	const { deletePlan } = await import('../services/plans');
	const store = makeStore({ plan: null });
	const deleted = await deletePlan('missing', store);
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
	const res = await ctrl.get(makeCtx({ planId: 'plan-1' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result?.plan.name, 'pro');
});

test('planController.get: 404 when not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.get(makeCtx({ planId: 'missing' }));
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
	const res = await ctrl.update(makeCtx({ planId: 'plan-1' }, { monthlyAmount: 9900 }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.ok(body.result?.plan);
});

test('planController.update: 404 when plan not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.update(makeCtx({ planId: 'missing' }, { name: 'x' }));
	assert.equal(res.status, 404);
});

test('planController.update: 422 when body is empty', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const ctrl = planController(makeStore(), config, priceCache);
	const res = await ctrl.update(makeCtx({ planId: 'plan-1' }, {}));
	assert.equal(res.status, 422);
});

test('planController.delete: 200 when deleted', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: basePlan });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.delete(makeCtx({ planId: 'plan-1' }));
	assert.equal(res.status, 200);
});

test('planController.delete: 404 when not found', async () => {
	const { planController } = await import('../controllers/plan.controller');
	const store = makeStore({ plan: null });
	const ctrl = planController(store, config, priceCache);
	const res = await ctrl.delete(makeCtx({ planId: 'missing' }));
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
// controller sees a prior state; writes are ignored.
function priorSubStore(status: string | null): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions') && sql.trimStart().startsWith('SELECT')) {
				return (status === null ? [] : [{ status }]) as T[];
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

function subCtrlStore(sub: unknown): { store: IStoreAdapter; upserts: unknown[][] } {
	const upserts: unknown[][] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) {
				if (sql.trimStart().startsWith('SELECT')) return (sub ? [sub] : []) as T[];
				upserts.push(params ?? []);
				return [] as T[];
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

test('buildBillingRoutes: registers first-party cancel + reactivate', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const paths = buildBillingRoutes(subCtrlStore(null).store, config).map(([m, p]) => `${m} ${p}`);
	assert.ok(paths.includes('POST /billing/subscription/cancel'));
	assert.ok(paths.includes('POST /billing/subscription/reactivate'));
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
