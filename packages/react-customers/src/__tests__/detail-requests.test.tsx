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
const { useCustomer, useCustomerEmails, useCustomerNotes, useCustomerPhones } = await import('../hooks');

// A customer detail screen used to fire one request per section (9 in the
// audit) although useCustomer() already returns every section. With
// { read: false } the section hooks give their actions only: ONE request, and
// a write still refreshes the detail.

const requests: string[] = [];
const server = createServer((req, res) => {
	requests.push(`${req.method} ${req.url}`);
	res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' });
	if (req.method === 'POST') return res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { email: { id: 'e1' } } }));
	res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { id: 'c1', emails: [], phones: [], notes: [] } }));
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
	const state: { current: T | null } = { current: null };
	function Probe() {
		const value = useHook();
		useEffect(() => {
			state.current = value;
		});
		return null;
	}
	const root = createRoot(window.document.createElement('div') as unknown as Element);
	act(() => {
		root.render(createElement(FonderieProvider, { client }, createElement(Probe)));
	});
	return { state, unmount: () => act(() => root.unmount()) };
}

test('a detail screen reads once; section actions still work and refresh the detail', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => ({
		detail: useCustomer('c1'),
		emails: useCustomerEmails('c1', { read: false }),
		phones: useCustomerPhones('c1', { read: false }),
		notes: useCustomerNotes('c1', { read: false }),
	}));
	await settle();
	assert.deepEqual(requests, ['GET /customers/c1'], 'one request for the whole screen');

	await act(async () => {
		await screen.state.current!.emails.addEmail({ email: 'a@client.example' });
	});
	await settle();
	assert.deepEqual(requests.slice(1), ['POST /customers/c1/emails', 'GET /customers/c1'], 'the write refreshed the detail, not a section list');
	screen.unmount();
});

test('without the option a section still reads its own list (unchanged default)', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-b' });
	const screen = mount(client, () => useCustomerEmails('c2'));
	await settle();
	assert.deepEqual(requests, ['GET /customers/c2/emails']);
	screen.unmount();
});
