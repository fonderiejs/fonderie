import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IFonderieContext } from '@fonderie/core';

import type { IBillingConfig } from '../config';
import { accountController } from '../controllers/account.controller';

function makeCtx(): IFonderieContext {
	return {
		meta: {},
		user: { id: 'user-1', email: 'a@b.com' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/'),
	} as unknown as IFonderieContext;
}

function makeStore(rows: { walletCustomer?: unknown; subscription?: unknown } = {}): IStoreAdapter {
	const stub = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_wallet_customers') && sql.includes('SELECT')) {
				return (rows.walletCustomer ? [rows.walletCustomer] : []) as unknown as T[];
			}
			if (sql.includes('fonderie_subscriptions') && sql.includes('SELECT')) {
				return (rows.subscription ? [rows.subscription] : []) as unknown as T[];
			}
			return [] as T[];
		},
		transaction: async (fn: (tx: IStoreAdapter) => unknown) => fn(stub as IStoreAdapter),
	} as unknown as IStoreAdapter;
	return stub;
}

function baseConfig(provider: Record<string, unknown> = {}): IBillingConfig {
	return {
		provider: { name: 'stripe', ...provider },
		successUrl: 's',
		cancelUrl: 'c',
		plans: [{ name: 'free' }],
		wallet: { currency: 'CRD', precision: 0 },
	} as unknown as IBillingConfig;
}

// ── payment-method ────────────────────────────────────────────────

test('accountController.getPaymentMethod: 501 when the provider cannot retrieve one', async () => {
	const ctrl = accountController(makeStore(), baseConfig());
	const res = await ctrl.getPaymentMethod(makeCtx());
	assert.equal(res.status, 501);
});

test('accountController.getPaymentMethod: returns the card DTO, resolving the wallet customer first', async () => {
	let seen: { customerId: string; paymentMethodId?: string | null } | null = null;
	const ctrl = accountController(
		makeStore({ walletCustomer: { providerCustomerId: 'cus_1', paymentMethodId: 'pm_1' } }),
		baseConfig({
			getPaymentMethod: async (opts: { customerId: string; paymentMethodId?: string | null }) => {
				seen = opts;
				return { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 };
			},
		}),
	);
	const res = await ctrl.getPaymentMethod(makeCtx());
	const body = (await res.json()) as { result: { paymentMethod: { brand: string; last4: string } } };
	assert.equal(res.status, 200);
	assert.equal(body.result.paymentMethod.brand, 'visa');
	assert.equal(body.result.paymentMethod.last4, '4242');
	// The consented card id from the wallet customer is passed through.
	assert.deepEqual(seen, { customerId: 'cus_1', paymentMethodId: 'pm_1' });
});

test('accountController.getPaymentMethod: null when no customer is on file', async () => {
	const ctrl = accountController(
		makeStore(),
		baseConfig({
			getPaymentMethod: async () => ({ brand: 'visa', last4: '4242', expMonth: 1, expYear: 2030 }),
		}),
	);
	const res = await ctrl.getPaymentMethod(makeCtx());
	const body = (await res.json()) as { result: { paymentMethod: unknown } };
	assert.equal(res.status, 200);
	assert.equal(body.result.paymentMethod, null);
});

// ── invoices ──────────────────────────────────────────────────────

test('accountController.listInvoices: 501 when the provider cannot list them', async () => {
	const ctrl = accountController(makeStore(), baseConfig());
	const res = await ctrl.listInvoices(makeCtx());
	assert.equal(res.status, 501);
});

test('accountController.listInvoices: maps invoices (bigint→string) for a subscription customer', async () => {
	const ctrl = accountController(
		makeStore({ subscription: { providerCustomerId: 'cus_1' } }),
		baseConfig({
			listInvoices: async () => [
				{
					id: 'in_1',
					number: '0001',
					amountDue: 0n,
					amountPaid: 4900n,
					currency: 'USD',
					status: 'paid',
					created: '2026-01-01T00:00:00Z',
					hostedInvoiceUrl: 'https://stripe/inv',
					invoicePdf: null,
				},
			],
		}),
	);
	const res = await ctrl.listInvoices(makeCtx());
	const body = (await res.json()) as {
		result: { invoices: Array<{ amountPaid: string; hostedInvoiceUrl: string | null }> };
	};
	assert.equal(res.status, 200);
	assert.equal(body.result.invoices.length, 1);
	const invoice = body.result.invoices[0];
	assert.ok(invoice);
	assert.equal(invoice.amountPaid, '4900');
	assert.equal(invoice.hostedInvoiceUrl, 'https://stripe/inv');
});

test('accountController.listInvoices: empty list when no customer is on file', async () => {
	const ctrl = accountController(
		makeStore(),
		baseConfig({ listInvoices: async () => [{ id: 'in_1' }] }),
	);
	const res = await ctrl.listInvoices(makeCtx());
	const body = (await res.json()) as { result: { invoices: unknown[] } };
	assert.equal(res.status, 200);
	assert.deepEqual(body.result.invoices, []);
});
