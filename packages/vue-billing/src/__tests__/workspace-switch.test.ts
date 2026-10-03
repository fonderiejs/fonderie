import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { Window } from 'happy-dom';

// A DOM for Vue's client renderer; installed before Vue loads.
const window = new Window();
Object.assign(globalThis, { window, document: window.document });
for (const name of ['Element', 'Node', 'SVGElement', 'MathMLElement', 'HTMLElement', 'Text', 'Comment'] as const) {
	(globalThis as Record<string, unknown>)[name] ??= (window as unknown as Record<string, unknown>)[name];
}

const { FonderieClient } = await import('@fonderie/client');
const { createApp, defineComponent, h, watchEffect } = await import('vue');
const { FonderiePlugin } = await import('@fonderie/vue');
const { useSubscription } = await import('../composables');

// Workspace billing: the subscriber is the selected workspace (X-Workspace-ID).
// A real FonderieClient against a server that answers per workspace.

const PLAN: Record<string, string> = { 'ws-a': 'starter', 'ws-b': 'pro' };
const delay: Record<string, number> = {};

const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	setTimeout(() => {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(
			JSON.stringify({
				reason: 'SUBSCRIPTION_FETCHED',
				explanation: '',
				result: { subscription: { id: `sub-${ws}`, plan: PLAN[ws], status: 'active' } },
			}),
		);
	}, delay[ws] ?? 0);
});

let baseUrl = '';
before(async () => {
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
	server.closeAllConnections();
	await new Promise<void>((r) => server.close(() => r()));
	await window.happyDOM.close();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => boolean, label: string) {
	for (let i = 0; i < 100; i++) {
		if (check()) return;
		await sleep(10);
	}
	assert.fail(`timed out waiting for: ${label}`);
}

function mount(client: InstanceType<typeof FonderieClient>) {
	const plans: Array<string | null> = [];
	let state: ReturnType<typeof useSubscription> | null = null;
	const Probe = defineComponent({
		setup() {
			state = useSubscription();
			watchEffect(() => {
				plans.push(state!.subscription.value?.plan ?? null);
			});
			return () => h('div');
		},
	});
	const app = createApp(Probe);
	app.use(FonderiePlugin, client);
	app.mount(window.document.createElement('div') as unknown as Element);
	return { plans, get: () => state!, unmount: () => app.unmount() };
}

test('useSubscription re-reads on a workspace switch and clears the old plan meanwhile', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-a' });
	const { plans, get, unmount } = mount(client);
	await until(() => get().subscription.value?.plan === 'starter', 'ws-a subscription');

	delay['ws-b'] = 50;
	plans.length = 0;
	client.setWorkspaceId('ws-b');
	await until(() => get().subscription.value?.plan === 'pro', 'ws-b subscription');
	assert.equal(plans[0], null, "ws-a's plan is cleared before ws-b's arrives");
	assert.ok(!plans.includes('starter'));
	delete delay['ws-b'];
	unmount();
});

test("a slow answer for the previous workspace never overwrites the current one's", async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-b' });
	const { get, unmount } = mount(client);
	await until(() => get().subscription.value?.plan === 'pro', 'ws-b subscription');

	delay['ws-a'] = 150;
	client.setWorkspaceId('ws-a');
	await sleep(5);
	client.setWorkspaceId('ws-b');
	await until(() => get().subscription.value?.plan === 'pro' && !get().isLoading.value, 'back on ws-b');
	await sleep(250);
	assert.equal(get().subscription.value?.plan, 'pro');
	assert.equal(get().isLoading.value, false);
	delete delay['ws-a'];
	unmount();
});
