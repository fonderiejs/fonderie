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
const { useCan, usePermissions, useRole } = await import('../composables');

// The UI gate in Vue, against a real HTTP server: nothing is allowed before the
// server answered, then exactly what it said; a composable waiting for an id
// asks for nothing.

const requests: string[] = [];
const server = createServer((req, res) => {
	requests.push(String(req.url));
	setTimeout(() => {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ reason: 'OK', explanation: '', result: {
			isOwner: false, isManager: true, isSuper: false,
			permissions: { jobs: { create: false, read: true, update: false, delete: false } },
		} }));
	}, 20);
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

function mount(client: InstanceType<typeof FonderieClient>, setup: () => () => void) {
	const Probe = defineComponent({
		setup() {
			watchEffect(setup());
			return () => h('div');
		},
	});
	const app = createApp(Probe);
	app.use(FonderiePlugin, client);
	app.mount(window.document.createElement('div') as unknown as Element);
	return () => app.unmount();
}

test('nothing is allowed before the server answered; then exactly what it said', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const frames: Array<{ loading: boolean; read: boolean; create: boolean; manager: boolean; single: boolean }> = [];
	const unmount = mount(client, () => {
		const p = usePermissions();
		const single = useCan('read', 'jobs');
		return () => frames.push({ loading: p.isLoading.value, read: p.can('read', 'jobs'), create: p.can('create', 'jobs'), manager: p.isManager.value, single: single.value });
	});
	await until(() => frames.at(-1)?.loading === false, 'permissions loaded');
	const early = frames.filter((f) => f.loading);
	assert.ok(early.length > 0, 'there was a loading frame');
	assert.equal(early.some((f) => f.read || f.create || f.manager || f.single), false, 'nothing allowed while loading');
	assert.deepEqual(frames.at(-1), { loading: false, read: true, create: false, manager: true, single: true });
	unmount();
});

test('a composable waiting for an id requests nothing', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const unmount = mount(client, () => {
		const r = useRole('');
		return () => void r.role.value;
	});
	await sleep(80);
	assert.deepEqual(requests, []);
	unmount();
});
