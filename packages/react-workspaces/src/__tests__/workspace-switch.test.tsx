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
const { useMembers } = await import('../hooks');

// The selected workspace's members, against a real HTTP server. They used to
// be read once on mount and never again: after a switch the screen kept
// showing the previous workspace's members. And every visit opened on a
// spinner. Both, as the user sees them, frame by frame.

const requests: string[] = [];
const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	requests.push(`${req.url}@${ws}`);
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { members: [{ userId: `owner-of-${ws}` }] } }));
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
	const history: T[] = [];
	function Probe() {
		const value = useHook();
		useEffect(() => {
			history.push(value);
		});
		return null;
	}
	const root = createRoot(window.document.createElement('div') as unknown as Element);
	act(() => {
		root.render(createElement(FonderieProvider, { client }, createElement(Probe)));
	});
	return { history, unmount: () => act(() => root.unmount()) };
}

const ids = (h: { members: Array<{ userId?: string }> }) => h.members.map((m) => m.userId);

test('members follow a workspace switch, and switching back is instant with no request', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => useMembers());
	await settle();
	assert.deepEqual(ids(screen.history.at(-1)!), ['owner-of-ws-a']);

	act(() => client.setWorkspaceId('ws-b'));
	await settle();
	assert.deepEqual(ids(screen.history.at(-1)!), ['owner-of-ws-b'], 'the switch re-read the members');

	const before = screen.history.length;
	act(() => client.setWorkspaceId('ws-a'));
	await settle();
	const back = screen.history.slice(before);
	assert.deepEqual(ids(back[0]!), ['owner-of-ws-a'], 'ws-a shows at once');
	assert.equal(back.some((h) => h.isLoading || ids(h).includes('owner-of-ws-b')), false);
	assert.equal(requests.filter((r) => r.endsWith('@ws-a')).length, 1, 'no second request for ws-a');
	screen.unmount();
});

test('opening the members screen again: data on the first frame, no request', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-c' });
	const first = mount(client, () => useMembers());
	await settle();
	first.unmount();
	const again = mount(client, () => useMembers());
	await settle();
	assert.deepEqual(ids(again.history[0]!), ['owner-of-ws-c']);
	assert.equal(again.history.some((h) => h.isLoading), false);
	assert.equal(requests.length, 1);
	again.unmount();
});
