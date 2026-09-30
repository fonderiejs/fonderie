import { strict as assert } from 'node:assert';
import { createServer, type ServerResponse } from 'node:http';
import { after, afterEach, before, test } from 'node:test';

import { Window } from 'happy-dom';

// A DOM for react-dom/client; installed before React loads.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });

const { FonderieClient } = await import('@fonderie/client');
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { FonderieProvider } = await import('../provider');
const { useRemoteConfig, withRemoteConfig } = await import('../hooks');

// The real protocol, end to end: GET /config/public and GET /sse/stream as the
// server brick speaks them. `values` is what the next /config/public returns.
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
		await act(() => new Promise((r) => setTimeout(r, 10)));
	}
};

// Every mounted root is unmounted after its test, pass or fail: a reader left
// mounted keeps its stream, which retries forever once the server is gone.
const mounted = new Set<() => void>();
afterEach(() => {
	for (const unmount of mounted) unmount();
	mounted.clear();
});
function mount(element: ReturnType<typeof createElement>, client: InstanceType<typeof FonderieClient>) {
	const container = document.createElement('div');
	const root = createRoot(container as unknown as Element);
	act(() => root.render(createElement(FonderieProvider, { client }, element)));
	let done = false;
	const unmount = () => {
		if (done) return;
		done = true;
		mounted.delete(unmount);
		act(() => root.unmount());
	};
	mounted.add(unmount);
	return { text: () => container.textContent ?? '', unmount };
}

function Banner() {
	const message = useRemoteConfig('MAINTENANCE_MESSAGE', '');
	return createElement('p', null, message || 'no banner');
}

test('useRemoteConfig: renders the fallback at once, then the server value, then a pushed change — no polling', async () => {
	values = { MAINTENANCE_MESSAGE: 'down at 9' };
	configLoads = 0;
	const client = new FonderieClient({ baseUrl });
	const view = mount(createElement(Banner), client);
	assert.equal(view.text(), 'no banner', 'first render never waits on the network');
	await until(() => view.text() === 'down at 9');
	values = { MAINTENANCE_MESSAGE: 'back up' };
	await act(async () => pushChange());
	await until(() => view.text() === 'back up');
	const loads = configLoads;
	await act(() => new Promise((r) => setTimeout(r, 300)));
	assert.equal(configLoads, loads, 'nothing polls');
	view.unmount();
	await until(() => open().length === 0);
});

test('many readers share one stream, which closes with the last one', async () => {
	values = { A: 1, B: 2 };
	const client = new FonderieClient({ baseUrl });
	const before = open().length;
	const A = () => createElement('i', null, String(useRemoteConfig('A', 0)));
	const B = () => createElement('i', null, String(useRemoteConfig('B', 0)));
	const view = mount(createElement('div', null, createElement(A), createElement(B), createElement(A)), client);
	await until(() => view.text() === '121');
	assert.equal(open().length - before, 1, 'three readers, one stream');
	view.unmount();
	await until(() => open().length === before);
});

test('a change to another key does not re-render this reader', async () => {
	values = { A: 1, B: 1 };
	const client = new FonderieClient({ baseUrl });
	let renders = 0;
	const A = () => {
		renders++;
		return createElement('i', null, String(useRemoteConfig('A', 0)));
	};
	const view = mount(createElement(A), client);
	await until(() => view.text() === '1');
	const settled = renders;
	values = { A: 1, B: 2 };
	await act(async () => pushChange());
	await until(() => client.config.get<number>('B', 0) === 2);
	assert.equal(renders, settled);
	view.unmount();
});

test('a key the server does not expose: fallback, and one warning', async () => {
	values = { WITH_JOBS_SCREEN: true };
	const warnings: string[] = [];
	const client = new FonderieClient({ baseUrl, log: { warn: (m) => warnings.push(m) } });
	const Typo = () => createElement('i', null, String(useRemoteConfig('WITH_JOBZ_SCREEN', false)));
	const view = mount(createElement('div', null, createElement(Typo), createElement(Typo)), client);
	await until(() => client.config.snapshot().loadedAt !== null);
	await act(() => new Promise((r) => setTimeout(r, 20)));
	assert.equal(view.text(), 'falsefalse');
	assert.equal(warnings.filter((w) => w.includes('WITH_JOBZ_SCREEN')).length, 1);
	view.unmount();
});

test('withRemoteConfig: the screen, or `off`, and flips live when the operator switches it', async () => {
	values = { WITH_JOBS_SCREEN: true };
	const client = new FonderieClient({ baseUrl });
	const Jobs = (p: { title: string }) => createElement('h1', null, `jobs: ${p.title}`);
	const Soon = (p: { title: string }) => createElement('h1', null, `soon: ${p.title}`);
	const Gated = withRemoteConfig('WITH_JOBS_SCREEN', Jobs, { off: Soon, fallback: true });
	assert.equal(Gated.displayName, 'withRemoteConfig(WITH_JOBS_SCREEN, Jobs)');
	const view = mount(createElement(Gated, { title: 'today' }), client);
	assert.equal(view.text(), 'jobs: today', 'fallback true: opens before any answer');
	values = { WITH_JOBS_SCREEN: false };
	await act(async () => pushChange());
	await until(() => view.text() === 'soon: today');
	values = { WITH_JOBS_SCREEN: true };
	await act(async () => pushChange());
	await until(() => view.text() === 'jobs: today');
	// The console stores what the operator typed: "off" is off, not a truthy string.
	values = { WITH_JOBS_SCREEN: 'off' };
	await act(async () => pushChange());
	await until(() => view.text() === 'soon: today');
	view.unmount();
});

test('withRemoteConfig: default fallback is off, and no `off` renders nothing', async () => {
	values = {};
	const client = new FonderieClient({ baseUrl, log: { warn: () => {} } });
	const Gated = withRemoteConfig('WITH_NEW_THING', () => createElement('b', null, 'new'));
	const view = mount(createElement(Gated), client);
	assert.equal(view.text(), '');
	view.unmount();
});

test('restored from device storage before the first render (the no-signal cold start)', async () => {
	const saved = new Map([['fonderie.config.public', JSON.stringify({ WITH_JOBS_SCREEN: false })]]);
	const client = new FonderieClient({
		baseUrl: 'http://127.0.0.1:9', // nothing listens: no signal
		config: { storage: { getItem: async (k) => saved.get(k) ?? null, setItem: () => {} } },
		sse: { fetch: () => new Promise(() => {}) },
	});
	await client.config.ready;
	const Gated = withRemoteConfig('WITH_JOBS_SCREEN', () => createElement('b', null, 'jobs'), {
		off: () => createElement('b', null, 'soon'),
		fallback: true,
	});
	const view = mount(createElement(Gated), client);
	assert.equal(view.text(), 'soon', 'the saved "off" decides on the very first render');
	view.unmount();
});
