// The catalog and the provider both hold prices, and they are not treated alike.
//
// A plan's `amount` is a DISPLAY value — the provider is authoritative, so a
// mismatch is a wrong number on a pricing page. A pack's priceAmount/currency
// are authoritative for the saved-card and auto-recharge paths while hosted
// checkout uses the provider's price, so a mismatch means the same pack costs
// DIFFERENT AMOUNTS depending on how it is bought. Nothing enforced agreement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPriceConsistency, describePriceProblems } from '../services/price-consistency';

const price = (over: Record<string, unknown> = {}) => ({
	priceId: 'price_x',
	lookupKey: null,
	unitAmount: 500n,
	currency: 'usd',
	interval: 'month',
	nickname: null,
	productId: 'prod_x',
	active: true,
	...over,
});
const providerWith = (p: unknown) => ({ resolvePriceById: async () => p as never });
const packConfig = (over: Record<string, unknown> = {}) => ({
	plans: [],
	wallet: {
		creditPacks: [
			{
				id: 'small',
				name: '10 credits',
				credits: 10n,
				priceAmount: 500n,
				currency: 'usd',
				priceId: 'price_x',
				...over,
			},
		],
	},
});

test('agreement reports ok with no problems', async () => {
	const r = await checkPriceConsistency(providerWith(price()), packConfig() as never);
	assert.equal(r.ok, true);
	assert.deepEqual(describePriceProblems(r), []);
});

test('a CURRENCY mismatch is caught — the real-world case', async () => {
	// Catalog says USD, provider charges CAD. Same figures, so an amount-only
	// check would pass and the gap would stay invisible.
	const r = await checkPriceConsistency(
		providerWith(price({ currency: 'cad' })),
		packConfig() as never,
	);
	assert.equal(r.ok, false);
	assert.equal(r.entries[0]!.problem, 'currency');
	assert.match(describePriceProblems(r)[0]!, /catalog says 500 usd, provider charges 500 cad/);
});

test('an AMOUNT mismatch is caught', async () => {
	const r = await checkPriceConsistency(
		providerWith(price({ unitAmount: 900n })),
		packConfig() as never,
	);
	assert.equal(r.entries[0]!.problem, 'amount');
});

test('both differing is reported as both, not just the first', async () => {
	const r = await checkPriceConsistency(
		providerWith(price({ unitAmount: 900n, currency: 'cad' })),
		packConfig() as never,
	);
	assert.equal(r.entries[0]!.problem, 'both');
});

test('an INACTIVE price is a problem even when the numbers agree', async () => {
	// Archived at the provider: checkout would fail, yet every figure matches.
	const r = await checkPriceConsistency(
		providerWith(price({ active: false })),
		packConfig() as never,
	);
	assert.equal(r.entries[0]!.problem, 'inactive');
	assert.match(describePriceProblems(r)[0]!, /INACTIVE/);
});

test('a price the provider does not have is reported as missing', async () => {
	const r = await checkPriceConsistency(
		{ resolvePriceById: async () => null },
		packConfig() as never,
	);
	assert.equal(r.entries[0]!.problem, 'missing');
	assert.equal(r.entries[0]!.actual, null);
});

test('entries WITHOUT a priceId are skipped — the catalog is then the only source', async () => {
	const cfg = {
		plans: [],
		wallet: {
			creditPacks: [{ id: 'small', name: '10', credits: 10n, priceAmount: 500n, currency: 'usd' }],
		},
	};
	const r = await checkPriceConsistency(providerWith(price()), cfg as never);
	assert.deepEqual(r.entries, [], 'nothing to reconcile without a provider price');
	assert.equal(r.ok, true);
});

test("a plan's display amount is compared, but its currency is not", async () => {
	// Plan prices carry no currency of their own, so only the amount can disagree.
	const cfg = {
		plans: [{ name: 'pro', monthly: { priceId: 'price_x', amount: 4900n } }],
		wallet: {},
	};
	const r = await checkPriceConsistency(
		providerWith(price({ unitAmount: 4900n, currency: 'cad' })),
		cfg as never,
	);
	assert.equal(r.ok, true, 'currency alone must not flag a plan');
	assert.equal(r.entries[0]!.ref, 'plan:pro:monthly');
});

test('a provider without price lookup reports unsupported, not failure', async () => {
	const r = await checkPriceConsistency({} as never, packConfig() as never);
	assert.equal(r.unsupported, true);
	assert.equal(r.ok, true, 'absence of the capability is not evidence of a problem');
});

test('a throwing provider is reported, never rethrown', async () => {
	// A diagnostic must not take down the thing it diagnoses.
	const r = await checkPriceConsistency(
		{
			resolvePriceById: async () => {
				throw new Error('stripe down');
			},
		},
		packConfig() as never,
	);
	assert.equal(r.ok, false);
	assert.match(describePriceProblems(r)[0]!, /stripe down/);
});
