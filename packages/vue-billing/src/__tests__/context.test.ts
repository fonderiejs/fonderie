import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IPlanDTO } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import {
	useBillingPortal,
	usePlan,
	useWalletPreferences,
	useWallet,
	useWalletTransactions,
	useWalletCheckout,
	useCancelSubscription,
	useReactivateSubscription,
	usePaymentMethod,
	useSetupPaymentMethod,
	useSavePaymentMethod,
	useRemovePaymentMethod,
	useInvoices,
} from '../composables';

const fakePlan = { id: 'plan_1', name: 'Pro' } as unknown as IPlanDTO;
const fakeBilling = {
	getPlan: async () => ({ result: { plan: fakePlan } }),
	getWallet: async () => ({ result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: true } } }),
	setWalletPreferences: async () => ({ result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: false } } }),
	getWalletTransactions: async () => ({ result: { transactions: [], nextCursor: null } }),
	createWalletCheckout: async () => ({ result: { url: 'https://checkout.stub/pay', sessionId: 'cs_1' } }),
	cancelSubscription: async () => ({ result: { atPeriodEnd: true, status: 'active', currentPeriodEnd: null } }),
	reactivateSubscription: async () => ({ result: { atPeriodEnd: false, status: 'active', currentPeriodEnd: null } }),
	getPaymentMethod: async () => ({ result: { paymentMethod: null } }),
	setupPaymentMethod: async () => ({ result: { clientSecret: 'seti_1_secret_abc' } }),
	savePaymentMethod: async () => ({
		result: { paymentMethod: { brand: 'visa', last4: '4242', expMonth: 9, expYear: 2027 } },
	}),
	removePaymentMethod: async () => ({ result: { removed: true } }),
	listInvoices: async () => ({ result: { invoices: [] } }),
};
const fakeClient = { billing: fakeBilling } as unknown as FonderieClient;

// Renders `run` inside a component's setup(), capturing its value or error.
async function runInSetup<T>(run: () => T, plugin?: boolean) {
	let value: T | undefined;
	let error: unknown;
	const Root = defineComponent({
		setup() {
			try {
				value = run();
			} catch (err) {
				error = err;
			}
			return () => h('div');
		},
	});
	const app = createSSRApp(Root);
	if (plugin) app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return { value, error };
}

test('useBillingPortal resolves the billing client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useBillingPortal(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.openPortal, 'function');
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
});

test('usePlan supports the no-client overload via the plugin', async () => {
	const { value, error } = await runInSetup(() => usePlan('plan_1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	const beforeMount = value.plan.value;
	assert.equal(beforeMount, null);
	assert.equal(value.isLoading.value, true);
	await value.refresh();
	assert.equal(value.error.value, null);
	assert.equal(value.isLoading.value, false);
	assert.equal(value.plan.value?.id, 'plan_1');
});

test('usePlan accepts an explicit client without any plugin installed', async () => {
	const explicit = Object.assign(Object.create(BillingClient.prototype) as BillingClient, {
		getPlan: async () => ({ result: { plan: fakePlan } }),
	});
	const { value, error } = await runInSetup(() => usePlan(explicit, 'plan_1'));
	assert.equal(error, undefined);
	assert.ok(value);
	await value.refresh();
	assert.equal(value.error.value, null);
	assert.equal(value.plan.value?.id, 'plan_1');
});

test('useBillingPortal throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useBillingPortal());
	assert.match(String(error), /useBillingPortal: no client/);
});

test('useWalletPreferences resolves the billing client via the plugin (read+mutate shape)', async () => {
	const { value, error } = await runInSetup(() => useWalletPreferences(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(value.spendPurchased.value, null); // onMounted read does not run under SSR
	assert.equal(value.isLoading.value, true);
	assert.equal(value.error.value, null);
	assert.equal(typeof value.refresh, 'function');
	assert.equal(typeof value.setSpendPurchased, 'function');

	// Exercise the read: getWallet fixture returns spendPurchased:true.
	await value.refresh();
	assert.equal(value.spendPurchased.value, true, 'refresh reads the current toggle');
	assert.equal(value.isLoading.value, false);

	// Exercise the mutate: setWalletPreferences fixture returns spendPurchased:false;
	// the composable adopts the response.
	await value.setSpendPurchased(false);
	assert.equal(value.spendPurchased.value, false, 'setter adopts the refreshed toggle');
});

test('useWalletPreferences surfaces + rethrows a setter error without leaving stale state', async () => {
	// getWallet succeeds (read true), setWalletPreferences rejects.
	const boom = {
		getWallet: async () => ({
			result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: true } },
		}),
		setWalletPreferences: async () => {
			throw new FonderieApiError('boom', 'nope', 500);
		},
	} as unknown as BillingClient;
	const { value } = await runInSetup(() => useWalletPreferences(boom), true);
	assert.ok(value);
	await value.refresh();
	assert.equal(value.spendPurchased.value, true);
	await assert.rejects(() => value.setSpendPurchased(false), /nope/);
	assert.ok(value.error.value, 'error surfaced');
	assert.equal(value.spendPurchased.value, true, 'toggle not optimistically mutated on failure');
});

test('wallet + account + lifecycle composables resolve from context and read/act', async () => {
	// Reads — onMounted doesn't fire under SSR, so drive refresh() explicitly.
	const w = (await runInSetup(() => useWallet(), true)).value!;
	await w.refresh();
	assert.equal(w.wallet.value?.balance, '0');
	assert.equal(w.isLoading.value, false);

	const tx = (await runInSetup(() => useWalletTransactions(), true)).value!;
	await tx.refresh();
	assert.deepEqual(tx.transactions.value, []);
	assert.equal(tx.hasMore.value, false);
	assert.equal(typeof tx.loadMore, 'function');

	const card = (await runInSetup(() => usePaymentMethod(), true)).value!;
	await card.refresh();
	assert.equal(card.paymentMethod.value, null);

	const inv = (await runInSetup(() => useInvoices(), true)).value!;
	await inv.refresh();
	assert.deepEqual(inv.invoices.value, []);

	// Mutations — the action resolves to the fixture result.
	const wc = (await runInSetup(() => useWalletCheckout(), true)).value!;
	assert.equal(await wc.checkout({ packId: 'small' }), 'https://checkout.stub/pay');

	const cancel = (await runInSetup(() => useCancelSubscription(), true)).value!;
	assert.equal((await cancel.cancel()).status, 'active');

	const react = (await runInSetup(() => useReactivateSubscription(), true)).value!;
	assert.equal((await react.reactivate()).atPeriodEnd, false);

	// In-app payment-method composables — setup returns the SetupIntent secret,
	// save resolves to the recorded card, remove completes without error.
	const setup = (await runInSetup(() => useSetupPaymentMethod(), true)).value!;
	assert.equal(await setup.setup(), 'seti_1_secret_abc');
	assert.equal(setup.isLoading.value, false);

	const savePm = (await runInSetup(() => useSavePaymentMethod(), true)).value!;
	assert.equal((await savePm.save('pm_card_visa'))?.last4, '4242');
	assert.equal(savePm.error.value, null);

	const removePm = (await runInSetup(() => useRemovePaymentMethod(), true)).value!;
	await removePm.remove();
	assert.equal(removePm.error.value, null);
	assert.equal(removePm.isLoading.value, false);
});
