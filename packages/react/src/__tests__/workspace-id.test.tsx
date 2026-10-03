import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';

import { Window } from 'happy-dom';

// A DOM for react-dom/client; installed before React loads.
const window = new Window();
Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });

const { FonderieClient } = await import('@fonderie/client');
const { act, createElement, useEffect } = await import('react');
const { createRoot } = await import('react-dom/client');
const { FonderieProvider, useWorkspaceId } = await import('../provider');

after(async () => {
	await window.happyDOM.close();
});

function render(element: ReturnType<typeof createElement>) {
	const root = createRoot(window.document.createElement('div') as unknown as Element);
	act(() => root.render(element));
	return () => act(() => root.unmount());
}

test('useWorkspaceId follows the provider client across switches', () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost', workspaceId: 'ws-a' });
	const seen: Array<string | undefined> = [];
	function Probe() {
		const id = useWorkspaceId();
		useEffect(() => {
			seen.push(id);
		}, [id]);
		return null;
	}
	const unmount = render(createElement(FonderieProvider, { client }, createElement(Probe)));
	act(() => client.setWorkspaceId('ws-b'));
	act(() => client.setWorkspaceId(undefined));
	unmount();
	assert.deepEqual(seen, ['ws-a', 'ws-b', undefined]);
});

test('useWorkspaceId follows an explicitly passed sub-client', () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost', workspaceId: 'ws-a' });
	const seen: Array<string | undefined> = [];
	function Probe() {
		const id = useWorkspaceId(client.billing);
		useEffect(() => {
			seen.push(id);
		}, [id]);
		return null;
	}
	// No provider: the explicit source is enough.
	const unmount = render(createElement(Probe));
	act(() => client.setWorkspaceId('ws-b'));
	unmount();
	assert.deepEqual(seen, ['ws-a', 'ws-b']);
});

test('a source that cannot report changes reads as undefined (older clients keep working)', () => {
	let value: string | undefined = 'unset';
	function Probe() {
		value = useWorkspaceId({ marker: 'old-client' });
		return null;
	}
	const unmount = render(createElement(Probe));
	unmount();
	assert.equal(value, undefined);
});
