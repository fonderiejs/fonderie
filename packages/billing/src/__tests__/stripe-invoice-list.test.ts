import assert from 'node:assert/strict';
import { test } from 'node:test';

import { StripeProvider } from '../providers/stripe';

// listInvoices unions the customer's invoices with its bare charges, so a
// credit-pack purchase (a charge, never an invoice) still shows up. On a
// dahlia-pinned client a Charge has NO `invoice` field, so the old filter
// (`!c.invoice`) let every subscription payment through as a second,
// unnumbered "paid" row next to its own invoice. Only pack charges —
// metadata.packId, copied by Stripe from the PaymentIntent — are listed now.
//
// The Stripe client sits behind a private client(); swapping it on the
// instance is the one seam a test has.
function providerWith(invoices: unknown[], charges: unknown[]): StripeProvider {
	const p = new StripeProvider('sk_test_x');
	(p as unknown as { client: () => Promise<unknown> }).client = async () => ({
		invoices: { list: async () => ({ data: invoices }) },
		charges: { list: async () => ({ data: charges }) },
	});
	return p;
}

const INVOICE = {
	id: 'in_sub_1',
	number: 'CVJH3GYR-0001',
	amount_due: 2400,
	amount_paid: 2400,
	currency: 'cad',
	status: 'paid',
	created: 1_790_998_080,
};

test('a subscription payment is listed once — its dahlia charge (no invoice field) is not a second row', async () => {
	const subscriptionCharge = {
		id: 'ch_sub_1',
		amount: 2400,
		currency: 'cad',
		status: 'succeeded',
		paid: true,
		created: 1_790_998_080,
		payment_intent: 'pi_sub_1',
		metadata: {},
		// no `invoice` key at all — exactly what dahlia returns
	};
	const rows = await providerWith([INVOICE], [subscriptionCharge]).listInvoices({ customerId: 'cus_1' });
	assert.deepEqual(
		rows.map((r) => r.id),
		['in_sub_1'],
	);
});

test('a credit-pack charge (metadata.packId) is still listed next to the invoices', async () => {
	const packCharge = {
		id: 'ch_pack_1',
		amount: 1000,
		currency: 'cad',
		status: 'succeeded',
		paid: true,
		created: 1_790_998_000,
		metadata: { packId: 'pack-100', subscriberType: 'workspace', subscriberId: 'w1', credits: '100' },
	};
	const failedPack = { ...packCharge, id: 'ch_pack_failed', status: 'failed', paid: false };
	const rows = await providerWith([INVOICE], [packCharge, failedPack]).listInvoices({ customerId: 'cus_1' });
	assert.deepEqual(rows.map((r) => r.id).sort(), ['ch_pack_1', 'in_sub_1']);
	const pack = rows.find((r) => r.id === 'ch_pack_1')!;
	assert.equal(pack.number, null);
	assert.equal(pack.status, 'paid');
});

test('a pre-basil charge that names its invoice is still excluded', async () => {
	const legacy = { id: 'ch_legacy', amount: 2400, status: 'succeeded', paid: true, created: 1, invoice: 'in_sub_1', metadata: { packId: 'x' } };
	const rows = await providerWith([INVOICE], [legacy]).listInvoices({ customerId: 'cus_1' });
	assert.deepEqual(rows.map((r) => r.id), ['in_sub_1']);
});
