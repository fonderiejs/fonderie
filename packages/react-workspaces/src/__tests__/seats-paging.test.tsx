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
const { useMembers, usePermissionCatalog, useWorkspaceSeats } = await import('../hooks');

// The seats read, the catalog's system-role grants, and the members list read
// whole (as before) or a page at a time — against a real HTTP server.

const requests: string[] = [];
const people = ['u1', 'u2', 'u3'].map((userId) => ({ userId, roles: [] }));
const server = createServer((req, res) => {
	requests.push(`${req.method} ${req.url}`);
	res.writeHead(200, { 'content-type': 'application/json' });
	const send = (result: unknown) => res.end(JSON.stringify({ reason: 'OK', explanation: '', result }));
	const url = new URL(req.url ?? '/', 'http://x');
	if (url.pathname === '/workspaces/seats') return send({ used: 3, members: 2, pendingInvites: 1, limit: 5, available: 2 });
	if (url.pathname === '/workspaces/permissions/catalog') {
		return send({ catalog: [], declared: true, systemGrants: { GUEST: { jobs: ['read'] } } });
	}
	if (url.pathname === '/workspaces/members') {
		const limit = url.searchParams.get('limit');
		if (!limit) return send({ members: people });
		const from = url.searchParams.get('cursor') === 'c2' ? 2 : 0;
		const rows = people.slice(from, from + Number(limit));
		return send({ members: rows, nextCursor: from + rows.length < people.length ? 'c2' : null });
	}
	send({});
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
	return { history, last: () => history[history.length - 1]!, unmount: () => act(() => root.unmount()) };
}

test('useWorkspaceSeats reads the seats; usePermissionCatalog carries systemGrants', async () => {
	const client = new FonderieClient({ baseUrl, workspaceId: 'ws-a' });
	const seats = mount(client, () => useWorkspaceSeats().seats);
	const catalog = mount(client, () => usePermissionCatalog().systemGrants);
	await settle();
	assert.equal(seats.history[0], null, 'nothing before the server answered');
	assert.deepEqual(seats.last(), { used: 3, members: 2, pendingInvites: 1, limit: 5, available: 2 });
	assert.deepEqual(catalog.last(), { GUEST: { jobs: ['read'] } });
	seats.unmount();
	catalog.unmount();
});

test('useMembers reads the whole list by default, and pages with pageSize', async () => {
	requests.length = 0;
	const whole = mount(new FonderieClient({ baseUrl, workspaceId: 'ws-a' }), () => {
		const m = useMembers();
		return { ids: m.members.map((x) => x.userId), hasMore: m.hasMore };
	});
	await settle();
	assert.deepEqual(whole.last(), { ids: ['u1', 'u2', 'u3'], hasMore: false });
	assert.deepEqual(requests.filter((r) => r.includes('/members')), ['GET /workspaces/members'], 'the unpaged read is unchanged');
	whole.unmount();

	requests.length = 0;
	let loadMore: () => Promise<void> = async () => {};
	const paged = mount(new FonderieClient({ baseUrl, workspaceId: 'ws-a' }), () => {
		const m = useMembers(undefined, { pageSize: 2 });
		loadMore = m.loadMore;
		return { ids: m.members.map((x) => x.userId), hasMore: m.hasMore };
	});
	await settle();
	assert.deepEqual(paged.last(), { ids: ['u1', 'u2'], hasMore: true });
	await act(async () => loadMore());
	await settle();
	assert.deepEqual(paged.last(), { ids: ['u1', 'u2', 'u3'], hasMore: false });
	assert.deepEqual(requests.filter((r) => r.includes('/members')), [
		'GET /workspaces/members?limit=2',
		'GET /workspaces/members?limit=2&cursor=c2',
	]);
	paged.unmount();
});
