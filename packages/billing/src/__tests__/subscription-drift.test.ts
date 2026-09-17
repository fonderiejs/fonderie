// fonderie_subscriptions is a MIRROR, fed entirely by webhooks. That is fine
// while every delivery lands and silently wrong the moment one does not — and
// deliveries stop for ordinary reasons: an endpoint disabled over a weekend, a
// retry budget exhausted after ~3 days, a payload shaped by an API version the
// normalizer did not expect.
//
// Nothing inside the app can tell a correct mirror from one that stopped being
// updated: both look identical from here. The question has to be asked of the
// provider, which is why this check needed a new seam method to exist at all —
// IBillingProvider could update, cancel and reactivate a subscription, and never
// read one back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	checkSubscriptionDrift,
	describeSubscriptionDrift,
} from '../services/subscription-drift';

const END = '2026-10-01T00:00:00.000Z';

const ourRow = (over: Record<string, unknown> = {}) => ({
	subscriberType: 'user',
	subscriberId: 'u1',
	providerSubscriptionId: 'sub_1',
	status: 'active',
	currentPeriodEnd: END,
	cancelAtPeriodEnd: false,
	...over,
});

const storeWith = (rows: unknown[]) => ({ query: async () => rows as never }) as never;

const providerWith = (subs: Record<string, unknown | null>) => ({
	getSubscription: async (id: string) => (subs[id] ?? null) as never,
});

const theirSub = (over: Record<string, unknown> = {}) => ({
	status: 'active',
	currentPeriodEnd: new Date(END),
	cancelAtPeriodEnd: false,
	...over,
});

test('a mirror that agrees reports ok and says nothing', async () => {
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub() }),
		storeWith([ourRow()]),
	);
	assert.equal(r.ok, true);
	assert.equal(r.checked, 1);
	assert.deepEqual(describeSubscriptionDrift(r), []);
});

test('we serve a plan the provider stopped billing — OVER-GRANTING', async () => {
	// The quiet one: the customer is happy, nobody files a ticket, and the
	// product is given away for as long as nobody looks.
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ status: 'canceled' }) }),
		storeWith([ourRow({ status: 'active' })]),
	);
	assert.equal(r.ok, false);
	assert.equal(r.drifted[0]!.impact, 'over-granting');
	assert.deepEqual(r.drifted[0]!.fields, ['status']);
});

test('the provider is billing someone we are not serving — UNDER-GRANTING', async () => {
	// The loud one: a paying customer is locked out right now.
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ status: 'active' }) }),
		storeWith([ourRow({ status: 'canceled' })]),
	);
	assert.equal(r.drifted[0]!.impact, 'under-granting');
});

test('a terminal row is still checked — that is where under-granting hides', async () => {
	// Filtering the query to non-terminal statuses would make the case above
	// invisible, which is the failure this check exists for.
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ status: 'active' }) }),
		storeWith([ourRow({ status: 'canceled' })]),
	);
	assert.equal(r.checked, 1);
	assert.equal(r.ok, false);
});

test('under-granting is reported BEFORE over-granting', async () => {
	// A locked-out paying customer is happening to someone; a leak is not.
	const r = await checkSubscriptionDrift(
		providerWith({
			sub_over: theirSub({ status: 'canceled' }),
			sub_under: theirSub({ status: 'active' }),
		}),
		storeWith([
			ourRow({ providerSubscriptionId: 'sub_over', status: 'active', subscriberId: 'u-over' }),
			ourRow({ providerSubscriptionId: 'sub_under', status: 'canceled', subscriberId: 'u-under' }),
		]),
	);
	const lines = describeSubscriptionDrift(r);
	assert.match(lines[0]!, /u-under.*under-granting/);
	assert.match(lines[1]!, /u-over.*over-granting/);
});

test('a subscription the provider does not have at all is reported', async () => {
	const r = await checkSubscriptionDrift(providerWith({}), storeWith([ourRow()]));
	assert.equal(r.drifted[0]!.theirs, null);
	assert.equal(r.drifted[0]!.impact, 'over-granting', 'we grant access for a subscription that is gone');
	assert.match(describeSubscriptionDrift(r)[0]!, /NO such subscription/);
});

test('a renewal date that moved by SECONDS is not drift', async () => {
	// Providers nudge the period end during retries and proration. Firing on that
	// would put a line in the log for every healthy account on every run, and a
	// check that is noisy when nothing is wrong is one people mute.
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ currentPeriodEnd: new Date('2026-10-01T00:04:17.000Z') }) }),
		storeWith([ourRow({ currentPeriodEnd: END })]),
	);
	assert.equal(r.ok, true);
});

test('a renewal date that moved by a DAY is drift, but not an access change', async () => {
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z') }) }),
		storeWith([ourRow()]),
	);
	assert.equal(r.ok, false);
	assert.deepEqual(r.drifted[0]!.fields, ['currentPeriodEnd']);
	assert.equal(r.drifted[0]!.impact, 'metadata', 'both sides still grant access');
});

test('a pending cancellation we never heard about is drift', async () => {
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ cancelAtPeriodEnd: true }) }),
		storeWith([ourRow({ cancelAtPeriodEnd: false })]),
	);
	assert.deepEqual(r.drifted[0]!.fields, ['cancelAtPeriodEnd']);
	assert.equal(r.drifted[0]!.impact, 'metadata');
});

test('trialing counts as access on both sides', async () => {
	const r = await checkSubscriptionDrift(
		providerWith({ sub_1: theirSub({ status: 'trialing' }) }),
		storeWith([ourRow({ status: 'active' })]),
	);
	assert.equal(r.drifted[0]!.impact, 'metadata', 'active vs trialing both serve the product');
});

test('a truncated sweep says so — never a silent cap', async () => {
	const rows = Array.from({ length: 5 }, (_, i) =>
		ourRow({ providerSubscriptionId: `sub_${i}`, subscriberId: `u${i}` }),
	);
	const r = await checkSubscriptionDrift(
		providerWith(Object.fromEntries(rows.map((x) => [x.providerSubscriptionId, theirSub()]))),
		storeWith(rows),
		{ limit: 3 },
	);
	assert.equal(r.checked, 3);
	assert.equal(r.truncated?.limit, 3);
	assert.match(describeSubscriptionDrift(r).at(-1)!, /more than 3 subscriptions exist/);
});

test('a provider that cannot read a subscription back reports unsupported', async () => {
	const r = await checkSubscriptionDrift({} as never, storeWith([ourRow()]));
	assert.equal(r.unsupported, true);
	assert.equal(r.ok, true, 'absence of the capability is not evidence of drift');
	assert.deepEqual(describeSubscriptionDrift(r), []);
});

test('a provider outage is an ERROR, never reported as drift', async () => {
	// The dangerous misread: treating "cannot reach the provider" as "every
	// subscription is gone" would invite a repair that cancels everyone.
	const r = await checkSubscriptionDrift(
		{
			getSubscription: async () => {
				throw new Error('stripe down');
			},
		},
		storeWith([ourRow()]),
	);
	assert.equal(r.ok, false);
	assert.deepEqual(r.drifted, [], 'no drift claimed from an unreadable provider');
	assert.match(describeSubscriptionDrift(r)[0]!, /stripe down/);
});

test('an unreadable database is an error, not a crash', async () => {
	const r = await checkSubscriptionDrift(providerWith({}), {
		query: async () => {
			throw new Error('relation does not exist');
		},
	} as never);
	assert.equal(r.ok, false);
	assert.match(describeSubscriptionDrift(r)[0]!, /relation does not exist/);
});
