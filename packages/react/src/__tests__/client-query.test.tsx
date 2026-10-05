import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';

import { Window } from 'happy-dom';

// What the user sees, render by render: a screen shown again opens on its
// data (no spinner, no request); a refresh never shows a spinner over data;
// an unchanged answer changes nothing.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });

const { FonderieClient } = await import('@fonderie/client');
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useClientQuery } = await import('../hooks/useClientQuery');

after(async () => {
	await window.happyDOM.close();
});

type Frame = { data: unknown; isLoading: boolean; isFetching: boolean };

async function mount(client: InstanceType<typeof FonderieClient>, key: string, fetcher: () => Promise<unknown>) {
	const frames: Frame[] = [];
	let api!: { refresh: () => Promise<unknown> };
	function Screen() {
		const q = useClientQuery(client.billing, key, fetcher);
		frames.push({ data: q.data, isLoading: q.isLoading, isFetching: q.isFetching });
		api = q;
		return null;
	}
	const root = createRoot(window.document.createElement('div') as unknown as Element);
	await act(async () => root.render(createElement(Screen)));
	return { frames, refresh: () => act(async () => void (await api.refresh())), unmount: () => act(() => root.unmount()) };
}

test('first visit loads; a second visit opens on the data with no request and no spinner', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	let calls = 0;
	const fetcher = async () => {
		calls++;
		return { plan: 'pro' };
	};
	const first = await mount(client, 'GET /billing/subscription::ws=w1', fetcher);
	assert.equal(first.frames[0]!.isLoading, true, 'nothing to show the very first time');
	assert.deepEqual(first.frames.at(-1)!.data, { plan: 'pro' });
	first.unmount();

	const second = await mount(client, 'GET /billing/subscription::ws=w1', fetcher);
	assert.deepEqual(second.frames[0], { data: { plan: 'pro' }, isLoading: false, isFetching: false });
	assert.equal(second.frames.some((f) => f.isLoading), false);
	assert.equal(calls, 1, 'shown again within the staleness window: no request');
	second.unmount();
});

test('pull-to-refresh with an unchanged answer: no spinner, same data object on every frame', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	const screen = await mount(client, 'k-refresh', async () => ({ items: [1, 2, 3] }));
	const shown = screen.frames.at(-1)!.data;
	await screen.refresh();
	const after = screen.frames.slice(screen.frames.findIndex((f) => f.data === shown));
	assert.equal(after.some((f) => f.isLoading), false, 'never a spinner over data');
	assert.ok(after.every((f) => f.data === shown), 'the same object throughout — nothing to redraw');
	assert.ok(after.some((f) => f.isFetching), 'the refresh did run, behind the data');
	screen.unmount();
});

test('a write invalidates a mounted screen: it refetches in the background, data stays', async () => {
	const real = globalThis.fetch;
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ reason: 'OK', explanation: '', result: {} }), { status: 200 })) as typeof fetch;
	try {
		const client = new FonderieClient({ baseUrl: 'http://localhost', accessToken: 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111' });
		let n = 0;
		const screen = await mount(client, 'GET /billing/subscription::ws=', async () => ({ status: ++n === 1 ? 'trialing' : 'active' }));
		await act(async () => {
			await client.request({ method: 'POST', path: '/billing/checkout' });
		});
		await act(async () => {});
		assert.deepEqual(screen.frames.at(-1)!.data, { status: 'active' });
		const fromFirstData = screen.frames.slice(screen.frames.findIndex((f) => f.data !== undefined));
		assert.equal(fromFirstData.some((f) => f.isLoading), false);
		screen.unmount();
	} finally {
		globalThis.fetch = real;
	}
});

test('a failing first fetch is not retried in a loop', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	let calls = 0;
	const screen = await mount(client, 'k-fail', async () => {
		calls++;
		throw new Error('offline');
	});
	await act(async () => {});
	await act(async () => {});
	assert.equal(calls, 1);
	assert.equal(screen.frames.at(-1)!.isLoading, false, 'the error shows instead of an endless spinner');
	screen.unmount();
});

test('cold start with a saved snapshot: data on the first frame, then refreshed behind it', async () => {
	const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const token = `${part({ alg: 'none' })}.${part({ sub: 'u-cold' })}.sig`;
	const saved = new Map<string, string>([
		[
			'fonderie.queries.v1',
			JSON.stringify({ v: 1, owner: 'u-cold', savedAt: Date.now(), entries: [['k-cold', { plan: 'starter' }, Date.now() - 60_000]] }),
		],
	]);
	const client = new FonderieClient({
		baseUrl: 'http://localhost',
		accessToken: token,
		queries: { persist: { storage: { getItem: async (k: string) => saved.get(k) ?? null, setItem: async (k: string, v: string) => void saved.set(k, v) } } },
	});
	await client.queries.hydrated; // an app holds its splash screen on this
	let calls = 0;
	const screen = await mount(client, 'k-cold', async () => {
		calls++;
		return { plan: 'pro' };
	});
	assert.deepEqual(screen.frames[0], { data: { plan: 'starter' }, isLoading: false, isFetching: false }, 'the saved data, at once');
	assert.equal(screen.frames.some((f) => f.isLoading), false, 'never a spinner');
	assert.equal(calls, 1, 'a cold start refreshes what it restored');
	assert.deepEqual(screen.frames.at(-1)!.data, { plan: 'pro' });
	screen.unmount();
});
