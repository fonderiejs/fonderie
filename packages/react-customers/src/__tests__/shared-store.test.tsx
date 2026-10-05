import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { Window } from 'happy-dom';

const window = new Window();
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });

const { FonderieClient } = await import('@fonderie/client');
const { act, createElement, useEffect } = await import('react');
const { createRoot } = await import('react-dom/client');
const { FonderieProvider } = await import('@fonderie/react');
const { useCustomers } = await import('../hooks');

// The customer list as a user meets it, against a real HTTP server: it used
// to open on a spinner every time and never follow a workspace switch (the
// customers client did not even report one). Offset paging must keep working,
// and a failed "load more" must not throw — list screens call it
// fire-and-forget from onEndReached.

const requests: string[] = [];
let failPages = false;
const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	const url = new URL(req.url ?? '/', 'http://x');
	requests.push(`${url.pathname}${url.search}@${ws}`);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	if (failPages && offset > 0) {
		res.writeHead(503, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ reason: 'UNAVAILABLE', explanation: 'try later' }));
		return;
	}
	const total = 3;
	const page = [0, 1, 2].slice(offset, offset + 2).map((i) => ({ id: `${ws}-c${i}` }));
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { customers: page, total } }));
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
async function settle() {
	for (let i = 0; i < 10; i++) await act(async () => sleep(5));
}

function mount<T>(client: InstanceType<typeof FonderieClient>, useHook: () => T) {
	const state: { current: T | null; history: T[] } = { current: null, history: [] };
	function Probe() {
		const value = useHook();
		useEffect(() => {
			state.current = value;
			state.history.push(value);
		});
		return null;
	}
	const root = createRoot(window.document.createElement('div') as unknown as Element);
	act(() => {
		root.render(createElement(FonderieProvider, { client }, createElement(Probe)));
	});
	return { state, unmount: () => act(() => root.unmount()) };
}

const ids = (s: { customers: Array<{ id: string }> }) => s.customers.map((c) => c.id);

test('offset paging: first page, then loadMore appends; total and hasMore follow', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-p' });
	const screen = mount(client, () => useCustomers({ limit: 2 }));
	await settle();
	assert.deepEqual(ids(screen.state.current!), ['ws-p-c0', 'ws-p-c1']);
	assert.equal(screen.state.current!.total, 3);
	assert.equal(screen.state.current!.hasMore, true);
	await act(async () => {
		await screen.state.current!.loadMore();
	});
	assert.deepEqual(ids(screen.state.current!), ['ws-p-c0', 'ws-p-c1', 'ws-p-c2']);
	assert.equal(screen.state.current!.hasMore, false);
	screen.unmount();
});

test('the list follows a workspace switch; switching back is instant, with no request', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => useCustomers({ limit: 2 }));
	await settle();
	act(() => client.setWorkspaceId('ws-b'));
	await settle();
	assert.deepEqual(ids(screen.state.current!), ['ws-b-c0', 'ws-b-c1']);
	const before = screen.state.history.length;
	act(() => client.setWorkspaceId('ws-a'));
	await settle();
	const back = screen.state.history.slice(before);
	assert.deepEqual(ids(back[0]!), ['ws-a-c0', 'ws-a-c1']);
	assert.equal(back.some((s) => s.isLoading || ids(s).some((id) => id.startsWith('ws-b'))), false);
	assert.equal(requests.filter((r) => r.endsWith('@ws-a')).length, 1);
	screen.unmount();
});

test('a failed "load more" reports on error and does not throw', async () => {
	failPages = true;
	try {
		const client = new FonderieClient({ baseUrl, workspaceId: 'ws-f' });
		const screen = mount(client, () => useCustomers({ limit: 2 }));
		await settle();
		await act(async () => {
			await screen.state.current!.loadMore(); // must resolve, not reject
		});
		await settle();
		assert.equal(screen.state.current!.error?.status, 503);
		assert.deepEqual(ids(screen.state.current!), ['ws-f-c0', 'ws-f-c1'], 'the rows shown stay');
		screen.unmount();
	} finally {
		failPages = false;
	}
});
