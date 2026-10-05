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
const { usePermissions, useRole, useRoles } = await import('../hooks');

// The UI gate, frame by frame against a real HTTP server: no frame may say
// "allowed" before the server did, the answer follows the workspace, a role
// change refreshes it, and a hook waiting for an id asks for nothing.

const requests: string[] = [];
const answers: Record<string, unknown> = {
	'ws-a': { isOwner: false, isManager: false, isSuper: false, permissions: { jobs: { create: false, read: true, update: false, delete: false } } },
	'ws-b': { isOwner: true, isManager: true, isSuper: true, permissions: {} },
};
let jobsCreateInA = false;
const server = createServer((req, res) => {
	const ws = String(req.headers['x-workspace-id'] ?? '');
	requests.push(`${req.method} ${req.url}@${ws}`);
	res.writeHead(200, { 'content-type': 'application/json' });
	if (req.method === 'DELETE') {
		jobsCreateInA = true; // the role change this write stands for
		return res.end(JSON.stringify({ reason: 'ROLE_DELETED', explanation: '', result: { membersAffected: 2, movedToDefaultRole: 1 } }));
	}
	if (req.url === '/workspaces/roles') return res.end(JSON.stringify({ reason: 'OK', explanation: '', result: { roles: [] } }));
	const a = structuredClone(answers[ws]) as { permissions: Record<string, Record<string, boolean>> };
	if (ws === 'ws-a' && jobsCreateInA) a.permissions['jobs']!['create'] = true;
	res.end(JSON.stringify({ reason: 'OK', explanation: '', result: a }));
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

test('no frame allows anything before the server answered; then exactly what it said', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => {
		const p = usePermissions();
		return { loading: p.isLoading, read: p.can('read', 'jobs'), create: p.can('create', 'jobs'), manager: p.isManager };
	});
	await settle();
	const loading = screen.history.filter((h) => h.loading);
	assert.ok(loading.length > 0, 'there was a loading frame');
	assert.equal(loading.some((h) => h.read || h.create || h.manager), false, 'nothing allowed while loading');
	assert.deepEqual(screen.history.at(-1), { loading: false, read: true, create: false, manager: false });
	screen.unmount();
});

test('the super role is allowed everything; the answer follows the workspace', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => usePermissions().can('delete', 'invoices'));
	await settle();
	assert.equal(screen.history.at(-1), false);
	act(() => client.setWorkspaceId('ws-b'));
	await settle();
	assert.equal(screen.history.at(-1), true);
	screen.unmount();
});

test('a role change refreshes what the member may do, and removeRole reports who held it', async () => {
	jobsCreateInA = false;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	let roles: ReturnType<typeof useRoles> | undefined;
	const screen = mount(client, () => {
		roles = useRoles();
		return usePermissions().can('create', 'jobs');
	});
	await settle();
	assert.equal(screen.history.at(-1), false);
	let result: unknown;
	await act(async () => {
		result = await roles!.removeRole('role-1');
	});
	await settle();
	assert.deepEqual(result, { membersAffected: 2, movedToDefaultRole: 1 });
	assert.equal(screen.history.at(-1), true, 'permissions were re-read after the write');
	screen.unmount();
});

test('a hook waiting for an id requests nothing', async () => {
	requests.length = 0;
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const screen = mount(client, () => useRole(''));
	await settle();
	assert.deepEqual(requests, []);
	screen.unmount();
});
