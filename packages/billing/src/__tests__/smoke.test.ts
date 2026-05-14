import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie-js/store';

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
			monthly: { amount: 2900, priceId: 'price_starter_monthly' },
			yearly: { amount: 29000, priceId: 'price_starter_yearly' },
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
			monthly: { amount: 7900, priceId: 'price_pro_monthly' },
			yearly: { amount: 79000, priceId: 'price_pro_yearly' },
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

	assert.equal(mod.name, '@fonderie-js/billing');
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
