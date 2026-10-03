import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IFonderieContext } from '@fonderie/core';

import type { IBillingConfig } from '../config';
import type { INormalizedInvoiceSummary } from '../providers/types';
import { accountController } from '../controllers/account.controller';

// GET /billing/invoices used to answer the newest 20 and silently drop the
// rest. It now pages by keyset on (created DESC, id DESC).

function invoice(id: string, created: string): INormalizedInvoiceSummary {
	return {
		id,
		number: null,
		amountDue: 100n,
		amountPaid: 100n,
		currency: 'CAD',
		status: 'paid',
		created,
		dueDate: null,
		hostedInvoiceUrl: null,
		invoicePdf: null,
	};
}

// 45 invoices over two customers (subscription + wallet), several sharing a
// second — the tie-break is what a cursor on `created` alone would get wrong.
const BY_CUSTOMER: Record<string, INormalizedInvoiceSummary[]> = { cus_sub: [], cus_wallet: [] };
for (let i = 0; i < 45; i++) {
	const second = Math.floor(i / 3); // three per second
	const created = new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();
	(i % 2 ? BY_CUSTOMER['cus_sub']! : BY_CUSTOMER['cus_wallet']!).push(
		invoice(`in_${String(i).padStart(3, '0')}`, created),
	);
}

function provider(honourBound: boolean) {
	return {
		name: 'stripe',
		listInvoices: async (opts: { customerId: string; limit?: number; createdLte?: string }) =>
			[...(BY_CUSTOMER[opts.customerId] ?? [])]
				.filter((inv) => !honourBound || !opts.createdLte || inv.created <= opts.createdLte)
				.sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0))
				.slice(0, opts.limit ?? 20),
	};
}

const store: IStoreAdapter = {
	query: async <T = unknown>(sql: string): Promise<T[]> => {
		if (sql.includes('fonderie_wallet_customers') && sql.includes('SELECT')) {
			return [{ providerCustomerId: 'cus_wallet' }] as T[];
		}
		if (sql.includes('fonderie_subscriptions') && sql.includes('SELECT')) {
			return [{ providerCustomerId: 'cus_sub' }] as T[];
		}
		return [] as T[];
	},
	transaction: async (fn) => fn(store),
};

function ctx(qs = ''): IFonderieContext {
	return {
		meta: {},
		user: { id: 'user-1', email: 'owner@acme.example' },
		workspace: null,
		tenant: null,
		request: new Request(`http://localhost/billing/invoices${qs}`),
	} as unknown as IFonderieContext;
}

function config(honourBound = true): IBillingConfig {
	return {
		provider: provider(honourBound),
		wallet: { currency: 'CAD' },
		successUrl: 's',
		cancelUrl: 'c',
		plans: [],
	} as unknown as IBillingConfig;
}

type Page = { invoices: Array<{ id: string }>; nextCursor: string | null };

async function page(qs: string, honourBound = true): Promise<{ status: number; result: Page }> {
	const res = await accountController(store, config(honourBound)).listInvoices(ctx(qs));
	const body = (await res.json()) as { result: Page };
	return { status: res.status, result: body.result };
}

test('invoices: every invoice exactly once, newest first, across pages and customers', async () => {
	const seen: string[] = [];
	let cursor: string | null = null;
	const sizes: number[] = [];
	do {
		const qs: string = cursor ? `?cursor=${cursor}` : '';
		const { status, result } = await page(qs);
		assert.equal(status, 200);
		sizes.push(result.invoices.length);
		seen.push(...result.invoices.map((i) => i.id));
		cursor = result.nextCursor;
	} while (cursor);
	assert.deepEqual(sizes, [20, 20, 5]);
	assert.equal(new Set(seen).size, 45, 'no invoice repeated or lost');
	const expected = Array.from({ length: 45 }, (_, i) => `in_${String(44 - i).padStart(3, '0')}`);
	assert.deepEqual(seen, expected);
});

test('invoices: limit is honoured and a page that fits says there is no next one', async () => {
	const first = await page('?limit=45');
	assert.equal(first.result.invoices.length, 45);
	assert.equal(first.result.nextCursor, null);
	const small = await page('?limit=7');
	assert.equal(small.result.invoices.length, 7);
	assert.ok(small.result.nextCursor);
});

test('invoices: a provider that ignores the bound never repeats a row', async () => {
	const first = await page('', false);
	const second = await page(`?cursor=${first.result.nextCursor}`, false);
	const firstIds = new Set(first.result.invoices.map((i) => i.id));
	assert.ok(second.result.invoices.every((i) => !firstIds.has(i.id)));
});

test('invoices: malformed cursor or limit → 422', async () => {
	assert.equal((await page('?cursor=not-a-cursor')).status, 422);
	assert.equal((await page('?limit=0')).status, 422);
	assert.equal((await page('?limit=101')).status, 422);
});
