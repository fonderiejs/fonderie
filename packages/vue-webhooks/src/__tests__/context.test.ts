import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IWebhookDeliveryDTO } from '@fonderie/client';
import { WebhooksClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useTestWebhookEndpoint } from '../composables/useTestWebhookEndpoint';
import { useWebhookDeliveries } from '../composables/useWebhookDeliveries';

const fakeDelivery = { id: 'del_1', status: 'succeeded' } as unknown as IWebhookDeliveryDTO;
const fakeWebhooks = {
	listDeliveries: async () => ({ result: { deliveries: [fakeDelivery] } }),
};
const fakeClient = { webhooks: fakeWebhooks } as unknown as FonderieClient;

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

test('useTestWebhookEndpoint resolves the webhooks client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useTestWebhookEndpoint(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.testEndpoint, 'function');
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
});

test('useWebhookDeliveries supports the no-client overload via the plugin', async () => {
	const { value, error } = await runInSetup(() => useWebhookDeliveries('ep_1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(value.error.value, null);
	assert.equal(value.isLoading.value, false);
	assert.deepEqual(value.deliveries.value, [fakeDelivery]);
});

test('useWebhookDeliveries accepts an explicit client without any plugin installed', async () => {
	const explicit = Object.assign(Object.create(WebhooksClient.prototype) as WebhooksClient, {
		listDeliveries: async () => ({ result: { deliveries: [fakeDelivery] } }),
	});
	const { value, error } = await runInSetup(() => useWebhookDeliveries(explicit, 'ep_1'));
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(value.error.value, null);
	assert.deepEqual(value.deliveries.value, [fakeDelivery]);
});

test('useTestWebhookEndpoint throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useTestWebhookEndpoint());
	assert.match(String(error), /useTestWebhookEndpoint: no client/);
});
