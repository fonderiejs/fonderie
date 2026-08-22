import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IWebhookDeliveryDTO } from '@fonderie/client';
import { WebhooksClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useWebhookDeliveries } from '../composables/useWebhookDeliveries';
import { useWebhookEndpoints } from '../composables/useWebhookEndpoints';

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
	return { value, error };
}

test('useWebhookEndpoints resolves the webhooks client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useWebhookEndpoints(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.testEndpoint, 'function');
	// The initial fetch runs in onMounted, which never fires during SSR.
	assert.deepEqual(value.endpoints.value, []);
	assert.equal(value.isLoading.value, true);
	assert.equal(value.error.value, null);
});

test('useWebhookDeliveries supports the no-client overload via the plugin', async () => {
	const { value, error } = await runInSetup(() => useWebhookDeliveries('ep_1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	assert.deepEqual(value.deliveries.value, []);
	assert.equal(value.isLoading.value, true);
	await value.refresh();
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
	await value.refresh();
	assert.equal(value.error.value, null);
	assert.deepEqual(value.deliveries.value, [fakeDelivery]);
});

test('useWebhookEndpoints throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useWebhookEndpoints());
	assert.match(String(error), /useWebhookEndpoints: no client/);
});

test('testEndpoint folds into useWebhookEndpoints and does not re-list', async () => {
	const log: unknown[] = [];
	const explicit = Object.assign(Object.create(WebhooksClient.prototype) as WebhooksClient, {
		listEndpoints: async (opts?: { bust?: boolean }) => {
			log.push(['list', opts?.bust ?? false]);
			return { result: { endpoints: [] } };
		},
		testEndpoint: async (endpointId: string) => {
			log.push(['test', endpointId]);
			return { result: { ok: true } };
		},
	});
	const { value, error } = await runInSetup(() => useWebhookEndpoints(explicit));
	assert.equal(error, undefined);
	assert.ok(value);
	const result = await value.testEndpoint('ep_9');
	assert.equal(result.ok, true);
	// A test delivery doesn't change the endpoints list — no refresh call.
	assert.deepEqual(log, [['test', 'ep_9']]);
});
