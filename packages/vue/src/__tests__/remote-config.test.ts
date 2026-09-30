import { strict as assert } from 'node:assert';
import { createServer, type ServerResponse } from 'node:http';
import { after, afterEach, before, test } from 'node:test';

import { Window } from 'happy-dom';

// A DOM for Vue's client renderer; installed before Vue loads.
const window = new Window();
Object.assign(globalThis, { window, document: window.document });
for (const name of ['Element', 'Node', 'SVGElement', 'MathMLElement', 'HTMLElement', 'Text', 'Comment'] as const) {
	(globalThis as Record<string, unknown>)[name] ??= (window as unknown as Record<string, unknown>)[name];
}

const { FonderieClient } = await import('@fonderie/client');
const { createApp, defineComponent, effectScope, h, nextTick } = await import('vue');
const { FonderiePlugin } = await import('../provider');
const { useRemoteConfig, withRemoteConfig } = await import('../composables');

// The real protocol, end to end: GET /config/public and GET /sse/stream.
let values: Record<string, unknown> = {};
let configLoads = 0;
const streams: ServerResponse[] = [];
const server = createServer((req, res) => {
	const url = new URL(req.url ?? '/', 'http://x');
	if (url.pathname === '/config/public') {
		configLoads++;
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ reason: 'PUBLIC_CONFIG_FETCHED', explanation: '', result: { values } }));
		return;
	}
	if (url.pathname === '/sse/stream') {
		res.writeHead(200, { 'content-type': 'text/event-stream' });
		res.write('event: fonderie.stream.reset\ndata: {}\n\n');
		streams.push(res);
		return;
	}
	res.writeHead(404).end();
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
const open = () => streams.filter((s) => !s.writableEnded && !s.destroyed);
const pushChange = () => {
	for (const s of open()) s.write('event: fonderie.config.changed\ndata: {"type":"fonderie.config.changed","data":{}}\n\n');
};
const until = async (cond: () => boolean, ms = 3000) => {
	const end = Date.now() + ms;
	while (!cond()) {
		if (Date.now() > end) throw new Error('condition not met in time');
		await new Promise((r) => setTimeout(r, 10));
		await nextTick();
	}
};

// Every app is unmounted after its test, pass or fail: a mounted reader keeps
// its stream, which retries forever once the server is gone.
const mounted = new Set<() => void>();
afterEach(() => {
	for (const u of mounted) u();
	mounted.clear();
});
function mount(root: ReturnType<typeof defineComponent>, client: InstanceType<typeof FonderieClient>, props?: Record<string, unknown>) {
	const el = document.createElement('div');
	const app = createApp(root, props);
	app.use(FonderiePlugin, client);
	app.mount(el as unknown as Element);
	const unmount = () => {
		if (!mounted.delete(unmount)) return;
		app.unmount();
	};
	mounted.add(unmount);
	return { text: () => el.textContent ?? '', unmount };
}

test('useRemoteConfig: fallback at once, then the server value, then a pushed change — no polling', async () => {
	values = { MAINTENANCE_MESSAGE: 'down at 9' };
	configLoads = 0;
	const client = new FonderieClient({ baseUrl });
	const Banner = defineComponent({
		setup() {
			const message = useRemoteConfig('MAINTENANCE_MESSAGE', '');
			return () => h('p', message.value || 'no banner');
		},
	});
	const view = mount(Banner, client);
	assert.equal(view.text(), 'no banner', 'first render never waits on the network');
	await until(() => view.text() === 'down at 9');
	values = { MAINTENANCE_MESSAGE: 'back up' };
	pushChange();
	await until(() => view.text() === 'back up');
	const loads = configLoads;
	await new Promise((r) => setTimeout(r, 300));
	assert.equal(configLoads, loads, 'nothing polls');
	view.unmount();
	await until(() => open().length === 0);
});

test('readers share one stream, released when their scopes end; another key does not update a reader', async () => {
	values = { A: 1, B: 1 };
	const client = new FonderieClient({ baseUrl });
	const before = open().length;
	const s1 = effectScope();
	const s2 = effectScope();
	const a = s1.run(() => useRemoteConfig('A', 0, client.config))!;
	s2.run(() => useRemoteConfig('B', 0, client.config));
	await until(() => a.value === 1 && open().length === before + 1);
	let updates = 0;
	const watcher = effectScope();
	const { watch } = await import('vue');
	watcher.run(() => watch(a, () => updates++));
	values = { A: 1, B: 2 };
	pushChange();
	await until(() => client.config.get<number>('B', 0) === 2);
	await nextTick();
	assert.equal(updates, 0, 'A did not change');
	s1.stop();
	await new Promise((r) => setTimeout(r, 30));
	assert.equal(open().length, before + 1, 'still read by B');
	s2.stop();
	watcher.stop();
	await until(() => open().length === before);
});

test('a key the server does not expose: fallback, and one warning', async () => {
	values = { WITH_JOBS_SCREEN: true };
	const warnings: string[] = [];
	const client = new FonderieClient({ baseUrl, log: { warn: (m) => warnings.push(m) } });
	const Typo = defineComponent({
		setup() {
			const on = useRemoteConfig('WITH_JOBZ_SCREEN', false);
			return () => h('i', String(on.value));
		},
	});
	const view = mount(defineComponent({ setup: () => () => h('div', [h(Typo), h(Typo)]) }), client);
	await until(() => client.config.snapshot().loadedAt !== null);
	await nextTick();
	assert.equal(view.text(), 'falsefalse');
	assert.equal(warnings.filter((w) => w.includes('WITH_JOBZ_SCREEN')).length, 1);
});

test('withRemoteConfig: the screen or `off`, props pass through, flips live', async () => {
	values = { WITH_JOBS_SCREEN: true };
	const client = new FonderieClient({ baseUrl });
	const Jobs = defineComponent({ name: 'Jobs', props: { title: String }, setup: (p) => () => h('h1', `jobs: ${p.title}`) });
	const Soon = defineComponent({ props: { title: String }, setup: (p) => () => h('h1', `soon: ${p.title}`) });
	const Gated = withRemoteConfig('WITH_JOBS_SCREEN', Jobs, { off: Soon, fallback: true });
	assert.equal((Gated as { name?: string }).name, 'WithRemoteConfig(WITH_JOBS_SCREEN, Jobs)');
	const view = mount(Gated as ReturnType<typeof defineComponent>, client, { title: 'today' });
	assert.equal(view.text(), 'jobs: today', 'fallback true: opens before any answer');
	values = { WITH_JOBS_SCREEN: false };
	pushChange();
	await until(() => view.text() === 'soon: today');
	values = { WITH_JOBS_SCREEN: true };
	pushChange();
	await until(() => view.text() === 'jobs: today');
	// The console stores what the operator typed: "False" is off, not a truthy string.
	values = { WITH_JOBS_SCREEN: ' False ' };
	pushChange();
	await until(() => view.text() === 'soon: today');
});

test('withRemoteConfig: default fallback is off; restored storage decides the first render', async () => {
	const saved = new Map([['fonderie.config.public', JSON.stringify({ WITH_JOBS_SCREEN: false })]]);
	const client = new FonderieClient({
		baseUrl: 'http://127.0.0.1:9', // nothing listens: no signal
		config: { storage: { getItem: async (k) => saved.get(k) ?? null, setItem: () => {} } },
		sse: { fetch: () => new Promise(() => {}) },
		log: { warn: () => {} },
	});
	await client.config.ready;
	const Gated = withRemoteConfig('WITH_JOBS_SCREEN', defineComponent({ setup: () => () => h('b', 'jobs') }), {
		off: defineComponent({ setup: () => () => h('b', 'soon') }),
		fallback: true,
	});
	assert.equal(mount(Gated as ReturnType<typeof defineComponent>, client).text(), 'soon');
	const Unknown = withRemoteConfig('WITH_NEW_THING', defineComponent({ setup: () => () => h('b', 'new') }));
	assert.equal(mount(Unknown as ReturnType<typeof defineComponent>, client).text(), '');
});
