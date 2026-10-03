import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toPaymentMethodDTO } from '../dtos/billing';
import { StripeProvider } from '../providers/stripe';

// "No card on file" was shown to a customer who had just paid: their only
// saved method was Stripe Link (type 'link', no card details), and only cards
// were reported. A Link method is reported as what it is; a card is still
// preferred when there is no default to follow.

type PM = { id: string; type: string; customer: string; card?: object; link?: { email: string } };

function providerWith(opts: { defaultPm?: string; pms: PM[] }): StripeProvider {
	const p = new StripeProvider('sk_test_x');
	(p as unknown as { client: () => Promise<unknown> }).client = async () => ({
		customers: { retrieve: async () => ({ invoice_settings: { default_payment_method: opts.defaultPm ?? null } }) },
		paymentMethods: {
			retrieve: async (id: string) => opts.pms.find((m) => m.id === id) ?? null,
			list: async ({ type }: { type: string }) => ({ data: opts.pms.filter((m) => m.type === type) }),
		},
	});
	return p;
}

const LINK: PM = { id: 'pm_link', type: 'link', customer: 'cus_1', link: { email: 'ana@acme.example' } };
const CARD: PM = {
	id: 'pm_card',
	type: 'card',
	customer: 'cus_1',
	card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030, fingerprint: 'fp_1' },
};

test('a Link-only customer has a payment method: Link, with its email — not "no card on file"', async () => {
	const pm = await providerWith({ pms: [LINK] }).getPaymentMethod({ customerId: 'cus_1' });
	assert.deepEqual(toPaymentMethodDTO(pm!), { type: 'link', brand: 'link', last4: '', expMonth: 0, expYear: 0, email: 'ana@acme.example' });
	assert.equal(pm!.fingerprint, null, 'nothing to fingerprint: a missing fraud signal, not a clean one');
});

test('the default method is what is shown, Link included', async () => {
	const pm = await providerWith({ defaultPm: 'pm_link', pms: [LINK, CARD] }).getPaymentMethod({ customerId: 'cus_1' });
	assert.equal(pm!.type, 'link');
});

test('with no default, a card is preferred over Link', async () => {
	const pm = await providerWith({ pms: [LINK, CARD] }).getPaymentMethod({ customerId: 'cus_1' });
	assert.deepEqual(toPaymentMethodDTO(pm!), { type: 'card', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030, email: null });
});

test('no saved method at all is still null', async () => {
	assert.equal(await providerWith({ pms: [] }).getPaymentMethod({ customerId: 'cus_1' }), null);
});
