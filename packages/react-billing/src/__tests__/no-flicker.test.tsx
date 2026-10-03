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
const { useInvoices, useSubscription } = await import('../hooks');

// The billing screen as a user meets it, against a real HTTP server: opening
// it again, switching workspace and back, pulling to refresh. What must hold:
// no spinner over data, no request the user did not cause, and no redraw when
// the server says the same thing.

const requests: string[] = [];
let invoiceFirstPage = [{ id: 'in-1' }];

const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	const url = new URL(req.url ?? '/', 'http://x');
	requests.push(`${url.pathname}${url.search}@${ws}`);
	res.writeHead(200, { 'content-type': 'application/json' });
	if (url.pathname === '/billing/subscription') {
		res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { subscription: { id: `sub-${ws}`, plan: ws === 'ws-a' ? 'starter' : 'pro', status: 'active' } } }));
		return;
	}
	if (url.pathname === '/billing/invoices') {
		const second = url.searchParams.get('cursor') === 'page-2';
		res.end(JSON.stringify({ reason: 'OK', explanation: '', result: second ? { invoices: [{ id: 'in-old' }], nextCursor: null } : { invoices: invoiceFirstPage, nextCursor: 'page-2' } }));
		return;
	}
	res.end('{}');
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

const count = (prefix: string) => requests.filter((r) => r.startsWith(prefix)).length;

test('opening the billing screen again: data on the first frame, no spinner, no request', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const first = mount(client, () => useSubscription());
	await settle();
	assert.equal(first.state.current?.subscription?.plan, 'starter');
	first.unmount();

	const again = mount(client, () => useSubscription());
	await settle();
	assert.equal(again.state.history[0]?.subscription?.plan, 'starter', 'the first committed frame has the data');
	assert.equal(again.state.history.some((h) => h.isLoading), false, 'never a spinner');
	assert.equal(count('/billing/subscription'), 1, 'the second visit made no request');
	again.unmount();
});

test('switching workspace and back: the first workspace reappears at once, without a request', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => useSubscription());
	await settle();
	act(() => client.setWorkspaceId('ws-b'));
	await settle();
	assert.equal(screen.state.current?.subscription?.plan, 'pro');
	const before = screen.state.history.length;
	act(() => client.setWorkspaceId('ws-a'));
	await settle();
	const back = screen.state.history.slice(before);
	assert.equal(back[0]?.subscription?.plan, 'starter', 'ws-a shows instantly');
	assert.equal(back.some((h) => h.isLoading || h.subscription?.plan === 'pro'), false, 'no spinner, never the other workspace');
	assert.equal(count('/billing/subscription@ws-a'), 1);
	screen.unmount();
});

test('pull-to-refresh with the same answer: no spinner, the same subscription object throughout', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => useSubscription());
	await settle();
	const shown = screen.state.current?.subscription;
	const before = screen.state.history.length;
	requests.length = 0;
	await act(async () => {
		await screen.state.current?.refresh({ force: true });
	});
	await settle();
	assert.equal(count('/billing/subscription'), 1, 'the refresh did reach the server');
	const after = screen.state.history.slice(before);
	assert.equal(after.some((h) => h.isLoading), false);
	assert.ok(after.every((h) => h.subscription === shown), 'same object: nothing to redraw');
	screen.unmount();
});

test('invoices: pages loaded with loadMore survive a refresh that returns the same first page', async () => {
	invoiceFirstPage = [{ id: 'in-1' }];
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-c' });
	const screen = mount(client, () => useInvoices());
	await settle();
	await act(async () => {
		await screen.state.current?.loadMore();
	});
	assert.deepEqual(screen.state.current?.invoices.map((i) => i.id), ['in-1', 'in-old']);
	await act(async () => {
		await screen.state.current?.refresh();
	});
	await settle();
	assert.deepEqual(screen.state.current?.invoices.map((i) => i.id), ['in-1', 'in-old'], 'unchanged first page keeps the extra page');

	// A new invoice on the first page re-anchors the list instead of mixing.
	invoiceFirstPage = [{ id: 'in-2' }, { id: 'in-1' }];
	await act(async () => {
		await screen.state.current?.refresh();
	});
	await settle();
	assert.deepEqual(screen.state.current?.invoices.map((i) => i.id), ['in-2', 'in-1']);
	assert.equal(screen.state.current?.hasMore, true);
	screen.unmount();
});
