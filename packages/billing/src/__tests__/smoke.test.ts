import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IPlan, ISubscription }              from '../types';
import type { IBillingConfig }                    from '../config';
import type { IBillingProvider, IBillingEvent }   from '../providers/types';

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
	}
}

// ── Config ────────────────────────────────────────────────────────

const config: IBillingConfig = {
	provider:   makeProvider(),
	successUrl: 'https://app.example.com/success',
	cancelUrl:  'https://app.example.com/cancel',
	plans: [
		{
			name:  'free',
			seats: 1,
		},
		{
			name:      'starter',
			seats:     5,
			trialDays: 14,
			monthly:   { amount: 2900,  priceId: 'price_starter_monthly' },
			yearly:    { amount: 29000, priceId: 'price_starter_yearly'  },
		},
		{
			name:    'pro',
			seats:   20,
			monthly: { amount: 7900,  priceId: 'price_pro_monthly' },
			yearly:  { amount: 79000, priceId: 'price_pro_yearly'  },
		},
		{
			name:  'enterprise',
			seats: null,
		},
	],
}


// ── Stub store ────────────────────────────────────────────────────

function makeStore(opts: {
	subscription?: ISubscription | null
	plan?:         IPlan | null
} = {}): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions') && sql.includes('SELECT')) {
				return (opts.subscription ? [opts.subscription] : []) as unknown as T[]
			}
			if (sql.includes('fonderie_plans') && sql.includes('SELECT') && opts.plan !== undefined) {
				return (opts.plan ? [opts.plan] : []) as unknown as T[]
			}
			if (sql.includes('INSERT INTO fonderie_plans') || sql.includes('UPDATE fonderie_plans')) {
				const plan: IPlan = opts.plan ?? {
					id: 'plan-1', name: 'test', seats: null, trialDays: 0,
					monthlyAmount: null, monthlyPriceId: null,
					yearlyAmount: null, yearlyPriceId: null,
					description: null, tier: 0, features: [], metadata: {},
				}
				return [plan] as unknown as T[]
			}
			if (sql.includes('DELETE FROM fonderie_plans')) {
				return (opts.plan ? [{ id: opts.plan.id }] : []) as unknown as T[]
			}
			return [] as T[]
		},
		transaction: async (fn) => fn(stub),
	}

	return stub;
}

const baseSubscription: ISubscription = {
	id:                     'sub-1',
	subscriberType:         'workspace',
	subscriberId:           'ws-1',
	plan:                   'pro',
	interval:               'month',
	status:                 'active',
	providerCustomerId:     'cus_123',
	providerSubscriptionId: 'sub_provider_123',
	currentPeriodStart:     '2026-05-01T00:00:00.000Z',
	currentPeriodEnd:       '2026-06-01T00:00:00.000Z',
	cancelAtPeriodEnd:      false,
	trialEndsAt:            null,
	createdAt:              '2026-05-01T00:00:00.000Z',
}

const baseUserSubscription: ISubscription = {
	...baseSubscription,
	id:             'sub-2',
	subscriberType: 'user',
	subscriberId:   'user-1',
}

const basePlan: IPlan = {
	id:             'plan-1',
	name:           'pro',
	seats:          20,
	trialDays:      0,
	monthlyAmount:  7900,
	monthlyPriceId: 'price_pro_monthly',
	yearlyAmount:   79000,
	yearlyPriceId:  'price_pro_yearly',
	description:    'Professional plan',
	tier:           2,
	features:       [{ name: 'API Access', description: 'Standard API access', enabled: true, limit: 100000 }],
	metadata:       { color: '#3B82F6' },
}

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
	const plan  = await getPlanById('plan-1', store);
	assert.equal(plan?.name, 'pro');
	assert.equal(plan?.monthlyAmount, 7900);
});

test('getPlanById: returns null when not found', async () => {
	const { getPlanById } = await import('../services/plans');
	const store = makeStore({ plan: null });
	const plan  = await getPlanById('missing', store);
	assert.equal(plan, null);
});

test('createPlan: returns created plan', async () => {
	const { createPlan } = await import('../services/plans');
	const store = makeStore({ plan: basePlan });
	const plan  = await createPlan({ name: 'pro', seats: 20, monthlyAmount: 7900 }, store);
	assert.equal(plan.name, 'pro');
});

test('updatePlan: returns updated plan', async () => {
	const { updatePlan } = await import('../services/plans');
	const updated = { ...basePlan, monthlyAmount: 9900 };
	const store   = makeStore({ plan: updated });
	const plan    = await updatePlan('plan-1', { monthlyAmount: 9900 }, store);
	assert.equal(plan?.monthlyAmount, 9900);
});

test('deletePlan: returns true when deleted', async () => {
	const { deletePlan } = await import('../services/plans');
	const store   = makeStore({ plan: basePlan });
	const deleted = await deletePlan('plan-1', store);
	assert.ok(deleted);
});

test('deletePlan: returns false when not found', async () => {
	const { deletePlan } = await import('../services/plans');
	const store   = makeStore({ plan: null });
	const deleted = await deletePlan('missing', store);
	assert.ok(!deleted);
});

// ── subscriptions ─────────────────────────────────────────────────

test('getSubscription: returns workspace subscription when found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store  = makeStore({ subscription: baseSubscription });
	const result = await getSubscription('workspace', 'ws-1', store);
	assert.equal(result?.plan,           'pro');
	assert.equal(result?.status,         'active');
	assert.equal(result?.subscriberType, 'workspace');
	assert.equal(result?.subscriberId,   'ws-1');
});

test('getSubscription: returns user subscription when found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store  = makeStore({ subscription: baseUserSubscription });
	const result = await getSubscription('user', 'user-1', store);
	assert.equal(result?.subscriberType, 'user');
	assert.equal(result?.subscriberId,   'user-1');
});

test('getSubscription: returns null when not found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store  = makeStore({ subscription: null });
	const result = await getSubscription('workspace', 'ws-missing', store);
	assert.equal(result, null);
});

// ── DTOs ──────────────────────────────────────────────────────────

test('toPlanDTO: maps all plan fields', async () => {
	const { toPlanDTO } = await import('../dtos/billing');
	const dto = toPlanDTO(basePlan);
	assert.equal(dto.id,               basePlan.id);
	assert.equal(dto.planId,           'PRO');
	assert.equal(dto.name,             basePlan.name);
	assert.equal(dto.tier,             2);
	assert.equal(dto.seats,            20);
	assert.equal(dto.trialDays,        0);
	assert.equal(dto.description,      'Professional plan');
	assert.equal(dto.pricing.monthly,  7900);
	assert.equal(dto.pricing.yearly,   79000);
	assert.equal(dto.pricing.currency, 'USD');
	assert.equal(dto.features.length,  1);
	assert.equal(dto.features[0]!.name,  'API Access');
	assert.equal(dto.metadata['color'],  '#3B82F6');
});

test('toPlanDTO: free plan amounts default to 0', async () => {
	const { toPlanDTO } = await import('../dtos/billing');
	const dto = toPlanDTO({ ...basePlan, monthlyAmount: null, yearlyAmount: null });
	assert.equal(dto.pricing.monthly, 0);
	assert.equal(dto.pricing.yearly,  0);
});

test('toSubscriptionDTO: maps workspace subscription fields', async () => {
	const { toSubscriptionDTO } = await import('../dtos/billing');
	const dto = toSubscriptionDTO(baseSubscription);
	assert.equal(dto.id,             baseSubscription.id);
	assert.equal(dto.subscriberType, 'workspace');
	assert.equal(dto.subscriberId,   'ws-1');
	assert.equal(dto.plan,           baseSubscription.plan);
	assert.equal(dto.status,         baseSubscription.status);
	assert.equal(dto.interval,       baseSubscription.interval);
	assert.equal(dto.createdAt,      baseSubscription.createdAt);
});

test('toSubscriptionDTO: maps user subscription fields', async () => {
	const { toSubscriptionDTO } = await import('../dtos/billing');
	const dto = toSubscriptionDTO(baseUserSubscription);
	assert.equal(dto.subscriberType, 'user');
	assert.equal(dto.subscriberId,   'user-1');
});

// ── requirePlan middleware ─────────────────────────────────────────

test('requirePlan: allows request when plan matches', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore({ subscription: baseSubscription });
	const middleware = requirePlan('pro', store);
	let nextCalled   = false;

	const ctx = {
		user:      { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta:      {},
		request:   new Request('http://localhost/test'),
		tenant:    null,
	} as any

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

test('requirePlan: blocks request when plan does not match', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore({ subscription: { ...baseSubscription, plan: 'free' } });
	const middleware = requirePlan(['pro', 'enterprise'], store);
	let nextCalled   = false;

	const ctx = {
		user:      { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta:      {},
		request:   new Request('http://localhost/test'),
		tenant:    null,
	} as any

	const response = await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(!nextCalled);
	assert.equal(response.status, 402);
});

test('requirePlan: blocks when subscription status is not active', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore({ subscription: { ...baseSubscription, plan: 'pro', status: 'past_due' } });
	const middleware = requirePlan('pro', store);

	const ctx = {
		user:      { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta:      {},
		request:   new Request('http://localhost/test'),
		tenant:    null,
	} as any

	const response = await middleware(ctx, async () => Response.json({ ok: true }));
	assert.equal(response.status, 402);
});

test('requirePlan: allows trialing subscription', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore({ subscription: { ...baseSubscription, plan: 'pro', status: 'trialing' } });
	const middleware = requirePlan('pro', store);
	let nextCalled   = false;

	const ctx = {
		user:      { id: 'user-1', email: 'a@b.com' },
		workspace: { id: 'ws-1' },
		meta:      {},
		request:   new Request('http://localhost/test'),
		tenant:    null,
	} as any

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

test('requirePlan: works with user-level subscription (no workspace)', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore({ subscription: baseUserSubscription });
	const middleware = requirePlan('pro', store);
	let nextCalled   = false;

	const ctx = {
		user:      { id: 'user-1', email: 'a@b.com' },
		workspace: null,
		meta:      {},
		request:   new Request('http://localhost/test'),
		tenant:    null,
	} as any

	await middleware(ctx, async () => {
		nextCalled = true;
		return Response.json({ ok: true });
	});

	assert.ok(nextCalled);
});

// ── IBillingProvider interface ────────────────────────────────────

test('IBillingProvider: stub satisfies interface', () => {
	const provider = makeProvider();
	assert.ok(typeof provider.createCustomer        === 'function');
	assert.ok(typeof provider.createCheckoutSession === 'function');
	assert.ok(typeof provider.createPortalSession   === 'function');
	assert.ok(typeof provider.constructEvent        === 'function');
});

test('IBillingProvider: createCustomer returns customerId', async () => {
	const provider = makeProvider();
	const result   = await provider.createCustomer({
		email:          'a@b.com',
		subscriberType: 'workspace',
		subscriberId:   'ws-1',
		userId:         'user-1',
	});
	assert.ok(typeof result.customerId === 'string');
	assert.ok(result.customerId.length > 0);
});

test('IBillingProvider: createCheckoutSession returns url', async () => {
	const provider = makeProvider();
	const result   = await provider.createCheckoutSession({
		customerId:     'cus_123',
		priceId:        'price_pro',
		subscriberType: 'workspace',
		subscriberId:   'ws-1',
		successUrl:     'https://app.com/success',
		cancelUrl:      'https://app.com/cancel',
	});
	assert.ok(typeof result.url === 'string');
	assert.ok(result.url.startsWith('https://'));
});

// ── BillingModule shape ───────────────────────────────────────────

test('BillingModule: satisfies IFonderieModule interface', async () => {
	const { BillingModule } = await import('../module');
	const store = makeStore();
	const mod   = new BillingModule(store, config);

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
