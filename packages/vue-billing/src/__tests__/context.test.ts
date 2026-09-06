import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IPlanDTO } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useBillingPortal } from '../composables/useBillingPortal';
import { usePlan } from '../composables/usePlan';
import { useWalletPreferences } from '../composables/useWalletPreferences';

const fakePlan = { id: 'plan_1', name: 'Pro' } as unknown as IPlanDTO;
const fakeBilling = {
	getPlan: async () => ({ result: { plan: fakePlan } }),
	getWallet: async () => ({ result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: true } } }),
	setWalletPreferences: async () => ({ result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: false } } }),
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
