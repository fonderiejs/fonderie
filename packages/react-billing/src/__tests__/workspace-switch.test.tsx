import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { Window } from 'happy-dom';

// A DOM for react-dom/client; installed before React loads.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });

const { FonderieClient } = await import('@fonderie/client');
const { act, createElement, useEffect } = await import('react');
const { createRoot } = await import('react-dom/client');
const { FonderieProvider } = await import('@fonderie/react');
const { useInvoices, useSubscription, useWalletTransactions } = await import('../hooks');

// Workspace billing: the subscriber is the selected workspace (X-Workspace-ID).
// A real FonderieClient against a server that answers per workspace, so the
// test covers the whole path: setWorkspaceId → onWorkspaceChange → re-read.

const PLAN: Record<string, string> = { 'ws-a': 'starter', 'ws-b': 'pro' };
// Per-workspace response delay — lets a test make the OLD workspace answer last.
const delay: Record<string, number> = {};
const seen: string[] = [];

const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	const url = new URL(req.url ?? '/', 'http://x');
	seen.push(`${url.pathname}@${ws}`);
	setTimeout(() => {
		res.writeHead(200, { 'content-type': 'application/json' });
		if (url.pathname === '/billing/subscription') {
			res.end(
				JSON.stringify({
					reason: 'SUBSCRIPTION_FETCHED',
					explanation: '',
					result: { subscription: { id: `sub-${ws}`, plan: PLAN[ws], status: 'active' } },
				}),
			);
			return;
		}
		if (url.pathname === '/billing/invoices') {
			const second = url.searchParams.get('cursor') === 'page-2';
			res.end(
				JSON.stringify({
					reason: 'INVOICES',
					explanation: '',
					result: second
						? { invoices: [{ id: `in-${ws}-2` }], nextCursor: null }
						: { invoices: [{ id: `in-${ws}-1` }], nextCursor: 'page-2' },
				}),
			);
			return;
		}
		if (url.pathname === '/billing/wallet/transactions') {
			res.end(
				JSON.stringify({
					reason: 'WALLET_TRANSACTIONS',
					explanation: '',
					result: { transactions: [{ id: `tx-${ws}` }], nextCursor: null },
				}),
			);
			return;
		}
		res.end('{}');
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
		await act(async () => {
			await sleep(10);
		});
	}
	assert.fail(`timed out waiting for: ${label}`);
}

function mount<T>(client: InstanceType<typeof FonderieClient>, useHook: () => T) {
	const state: { current: T | null; history: T[] } = { current: null, history: [] };
	// Record on COMMIT (an effect), not during render: a render React discards
	// (a render-phase state update restarts it) never reaches the screen.
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

test('useSubscription re-reads when the workspace changes, without showing the old one meanwhile', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-a' });
	const { state, unmount } = mount(client, () => useSubscription());
	await until(() => state.current?.subscription?.plan === 'starter', 'ws-a subscription');

	delay['ws-b'] = 50;
	state.history.length = 0;
	await act(async () => {
		client.setWorkspaceId('ws-b');
	});
	// The first render after the switch already dropped ws-a's subscription.
	assert.equal(state.history[0]?.subscription, null);
	assert.equal(state.history[0]?.isLoading, true);
	await until(() => state.current?.subscription?.plan === 'pro', 'ws-b subscription');
	assert.ok(
		state.history.every((s) => s.subscription?.plan !== 'starter'),
		"ws-a's plan is never shown after the switch",
	);
	delete delay['ws-b'];
	unmount();
});

test('a slow answer for the previous workspace never lands on top of the new one', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-b' });
	const { state, unmount } = mount(client, () => useSubscription());
	await until(() => state.current?.subscription?.plan === 'pro', 'ws-b subscription');

	// Switch to ws-a (slow), then straight back to ws-b (fast): ws-a's late
	// answer arrives last and must be dropped.
	delay['ws-a'] = 150;
	await act(async () => {
		client.setWorkspaceId('ws-a');
	});
	await act(async () => {
		client.setWorkspaceId('ws-b');
	});
	await until(() => state.current?.subscription?.plan === 'pro', 'back on ws-b');
	await act(async () => {
		await sleep(250); // ws-a's answer has now arrived
	});
	assert.equal(state.current?.subscription?.plan, 'pro');
	assert.equal(state.current?.isLoading, false);
	delete delay['ws-a'];
	unmount();
});

test('setting the same workspace again does not re-read', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-a' });
	const { state, unmount } = mount(client, () => useSubscription());
	await until(() => state.current?.subscription?.plan === 'starter', 'ws-a subscription');
	seen.length = 0;
	await act(async () => {
		client.setWorkspaceId('ws-a');
		await sleep(30);
	});
	assert.deepEqual(seen, []);
	unmount();
});

test('useWalletTransactions shows only the new workspace ledger after a switch', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-a' });
	const { state, unmount } = mount(client, () => useWalletTransactions());
	await until(() => state.current?.transactions[0]?.id === 'tx-ws-a', 'ws-a ledger');
	await act(async () => {
		client.setWorkspaceId('ws-b');
	});
	await until(() => state.current?.transactions[0]?.id === 'tx-ws-b', 'ws-b ledger');
	assert.deepEqual(
		state.current?.transactions.map((t) => t.id),
		['tx-ws-b'],
	);
	unmount();
});

test('useInvoices pages with loadMore, and a switch starts the new workspace at page one', async () => {
	const client = new FonderieClient({ baseUrl, accessToken: 'tok', workspaceId: 'ws-a' });
	const { state, unmount } = mount(client, () => useInvoices());
	await until(() => state.current?.invoices[0]?.id === 'in-ws-a-1', 'ws-a first page');
	assert.equal(state.current?.hasMore, true);
	await act(async () => {
		await state.current?.loadMore();
	});
	await until(() => state.current?.invoices.length === 2, 'second page appended');
	assert.deepEqual(
		state.current?.invoices.map((i) => i.id),
		['in-ws-a-1', 'in-ws-a-2'],
	);
	assert.equal(state.current?.hasMore, false);

	await act(async () => {
		client.setWorkspaceId('ws-b');
	});
	await until(() => state.current?.invoices[0]?.id === 'in-ws-b-1', 'ws-b first page');
	assert.deepEqual(
		state.current?.invoices.map((i) => i.id),
		['in-ws-b-1'],
	);
	assert.equal(state.current?.hasMore, true);
	unmount();
});
