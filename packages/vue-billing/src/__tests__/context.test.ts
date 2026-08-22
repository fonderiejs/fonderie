import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IPlanDTO } from '@fonderie/client';
import { BillingClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useBillingPortal } from '../composables/useBillingPortal';
import { usePlan } from '../composables/usePlan';

const fakePlan = { id: 'plan_1', name: 'Pro' } as unknown as IPlanDTO;
const fakeBilling = {
	getPlan: async () => ({ result: { plan: fakePlan } }),
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
	// Let the setup-time refresh() promise chain settle.
	await new Promise((resolve) => setTimeout(resolve, 0));
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
	assert.equal(value.error.value, null);
	assert.equal(value.plan.value?.id, 'plan_1');
});

test('useBillingPortal throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useBillingPortal());
	assert.match(String(error), /useBillingPortal: no client/);
});
