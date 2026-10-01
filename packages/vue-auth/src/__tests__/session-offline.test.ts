import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieApiError, type AuthClient, type FonderieClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useSession } from '../composables';

// Node has no localStorage; the web storage helpers need one.
(globalThis as { localStorage?: unknown }).localStorage ??= { setItem() {}, getItem: () => null, removeItem() {} };

// docs/SESSION-DESIGN.md, Phase 4: a session check that fails because the
// device is offline must not sign the user out. Only a refusal does.
async function sessionWith(failure: unknown) {
	const cleared: Array<string | undefined> = [];
	const auth = {
		getUser: async () => {
			throw failure;
		},
		setAccessToken: (t: string | undefined) => cleared.push(t),
		hasAccessToken: () => true,
	} as unknown as AuthClient;
	let value: ReturnType<typeof useSession> | undefined;
	const Probe = defineComponent({
		setup() {
			value = useSession();
			return () => null;
		},
	});
	const app = createSSRApp(Probe);
	app.use(FonderiePlugin, { auth } as unknown as FonderieClient);
	await renderToString(app);
	cleared.length = 0; // whatever mounting did; we test refresh() itself
	await value!.refresh();
	return cleared;
}

test('useSession: offline keeps the session', async () => {
	assert.deepEqual(await sessionWith(new TypeError('Failed to fetch')), []);
});

test('useSession: a 5xx keeps the session', async () => {
	assert.deepEqual(await sessionWith(new FonderieApiError('UNAVAILABLE', 'down', 503)), []);
});

test('useSession: the server refusing the session signs out', async () => {
	assert.deepEqual(await sessionWith(new FonderieApiError('UNAUTHORIZED', 'expired', 401)), [undefined]);
});
