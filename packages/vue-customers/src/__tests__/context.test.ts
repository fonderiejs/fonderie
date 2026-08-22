import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useCustomer, useCustomers, useCustomerTags } from '../composables';

const fakeCustomer = { id: 'cust-1', firstName: 'Ada' };
// instanceof CustomersClient must pass for the overloaded composables.
const fakeCustomers: CustomersClient = Object.assign(Object.create(CustomersClient.prototype), {
	listCustomers: async () => ({ result: { customers: [fakeCustomer] } }),
	getCustomer: async (customerId: string, input: { depth?: 1 | 2 }) => ({
		result: { ...fakeCustomer, id: customerId, depth: input.depth },
	}),
	listTags: async () => ({ result: { tags: ['vip'] } }),
});
const fakeClient = { customers: fakeCustomers } as unknown as FonderieClient;

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

test('useCustomers resolves the client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useCustomers(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	assert.equal(value.isLoading.value, true);
	assert.deepEqual(value.customers.value, []);
	await value.refresh();
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
	assert.deepEqual(value.customers.value, [fakeCustomer]);
});

test('useCustomer(customerId) resolves via the plugin without a client argument', async () => {
	const { value, error } = await runInSetup(() => useCustomer('cust-1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	const beforeMount = value.customer.value;
	assert.equal(beforeMount, null);
	assert.equal(value.isLoading.value, true);
	await value.refresh();
	assert.equal(value.isLoading.value, false);
	assert.equal(value.customer.value?.id, 'cust-1');
	// depth defaults to 2 when the client argument is dropped
	assert.equal((value.customer.value as { depth?: number })?.depth, 2);
});

test('an explicit client argument works without any plugin installed', async () => {
	const { value, error } = await runInSetup(() => useCustomers(fakeCustomers));
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	await value.refresh();
	assert.deepEqual(value.customers.value, [fakeCustomer]);

	const tags = await runInSetup(() => useCustomerTags(fakeCustomers, 'cust-1'));
	assert.equal(tags.error, undefined);
	assert.ok(tags.value);
	await tags.value.refresh();
	assert.deepEqual(tags.value.tags.value, ['vip']);
});

test('throws a composable-named error with no plugin and no argument', async () => {
	const { error } = await runInSetup(() => useCustomers());
	assert.match(String(error), /useCustomers: no client/);

	const single = await runInSetup(() => useCustomer('cust-1'));
	assert.match(String(single.error), /useCustomer: no client/);
});
