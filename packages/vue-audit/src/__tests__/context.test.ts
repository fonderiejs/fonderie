import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, IAuditEventDTO } from '@fonderie/client';
import { AuditClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useAuditEvents } from '../composables/useAuditEvents';

const fakeEvent = { id: 'evt_1', action: 'user.login' } as unknown as IAuditEventDTO;
const fakeAudit = {
	listEvents: async () => ({ result: { events: [fakeEvent], nextCursor: null } }),
};
const fakeClient = { audit: fakeAudit } as unknown as FonderieClient;

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

test('useAuditEvents resolves the audit client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useAuditEvents(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.refresh, 'function');
	assert.equal(typeof value.loadMore, 'function');
	assert.equal(value.isLoading.value, false);
	assert.equal(value.isLoadingMore.value, false);
	assert.equal(value.error.value, null);
	assert.equal(value.hasMore.value, false);
	assert.deepEqual(value.events.value, [fakeEvent]);
});

test('useAuditEvents accepts an explicit client without any plugin installed', async () => {
	const explicit = Object.assign(Object.create(AuditClient.prototype) as AuditClient, {
		listEvents: async () => ({ result: { events: [fakeEvent], nextCursor: null } }),
	});
	const { value, error } = await runInSetup(() => useAuditEvents(explicit, {}));
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(value.error.value, null);
	assert.deepEqual(value.events.value, [fakeEvent]);
});

test('useAuditEvents throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useAuditEvents());
	assert.match(String(error), /useAuditEvents: no client/);
});
