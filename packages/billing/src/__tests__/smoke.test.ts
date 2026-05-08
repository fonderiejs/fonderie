import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { IStoreAdapter }    from '@fonderie-js/store';

import type { ISubscription }    from '../types';
import type { IBillingConfig }   from '../config';
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
	}
}

// ── Config ────────────────────────────────────────────────────────

const config: IBillingConfig = {
	provider: makeProvider(),
	plans: [
		{
			name:  'free',
			seats: 1,
		},
		{
			name:      'starter',
			seats:     5,
			trialDays: 14,
			monthly:   { amount: 49,  priceId: 'price_starter_monthly' },
			yearly:    { amount: 490, priceId: 'price_starter_yearly'  },
		},
		{
			name:    'pro',
			seats:   20,
			monthly: { amount: 149,  priceId: 'price_pro_monthly' },
			yearly:  { amount: 1490, priceId: 'price_pro_yearly'  },
		},
		{
			name:  'enterprise',
			seats: null,
		},
	],
}


// ── Stub store ────────────────────────────────────────────────────

function makeStore(subscription?: ISubscription | null): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async (sql: string) => {
			if (sql.includes('fonderie_subscriptions') && sql.includes('SELECT')) {
				if (!subscription) {
					return [];
				}
				
				return [subscription];
			}

			return [];
		},
		transaction: async (fn) => fn(stub),
	}

	return stub;
}

const baseSubscription: ISubscription = {
	id:                    'sub-1',
	workspaceId:           'ws-1',
	plan:                  'pro',
	status:                'active',
	providerCustomerId:    'cus_123',
	providerSubscriptionId: 'sub_provider_123',
	currentPeriodStart:    new Date(),
	currentPeriodEnd:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	cancelAtPeriodEnd:     false,
	trialEndsAt:           null,
	createdAt:             new Date(),
}

// ── plans ─────────────────────────────────────────────────────────

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

// ── subscriptions ─────────────────────────────────────────────────

test('getSubscription: returns subscription when found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store  = makeStore(baseSubscription);
	const result = await getSubscription('ws-1', store);
	assert.equal(result?.plan,   'pro');
	assert.equal(result?.status, 'active');
});

test('getSubscription: returns null when not found', async () => {
	const { getSubscription } = await import('../services/subscriptions');
	const store  = makeStore(null);
	const result = await getSubscription('ws-missing', store);
	assert.equal(result, null);
});

// ── requirePlan middleware ─────────────────────────────────────────

test('requirePlan: allows request when plan matches', async () => {
	const { requirePlan } = await import('../middlewares/require-plan');
	const store      = makeStore(baseSubscription);
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
	const store      = makeStore({ ...baseSubscription, plan: 'free' });
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
	const store      = makeStore({ ...baseSubscription, plan: 'pro', status: 'past_due' });
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
	const store      = makeStore({ ...baseSubscription, plan: 'pro', status: 'trialing' });
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
		email:       'a@b.com',
		workspaceId: 'ws-1',
		userId:      'user-1',
	});
	assert.ok(typeof result.customerId === 'string');
	assert.ok(result.customerId.length > 0);
});

test('IBillingProvider: createCheckoutSession returns url', async () => {
	const provider = makeProvider();
	const result   = await provider.createCheckoutSession({
		customerId:  'cus_123',
		priceId:     'price_pro',
		workspaceId: 'ws-1',
		successUrl:  'https://app.com/success',
		cancelUrl:   'https://app.com/cancel',
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
