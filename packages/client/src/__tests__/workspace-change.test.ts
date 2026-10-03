import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieClient } from '../client';

// Per-workspace screens (billing above all) re-read on a switch, so both the
// client and its billing sub-client say when the workspace changes — and only
// when it actually changes.

test('FonderieClient.onWorkspaceChange fires on a change only, and unsubscribes', () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost', workspaceId: 'ws-a' });
	const seen: Array<string | undefined> = [];
	const off = client.onWorkspaceChange((id) => seen.push(id));

	assert.equal(client.getWorkspaceId(), 'ws-a');
	client.setWorkspaceId('ws-a'); // same → silent
	client.setWorkspaceId('ws-b');
	client.setWorkspaceId(undefined);
	off();
	client.setWorkspaceId('ws-c');

	assert.deepEqual(seen, ['ws-b', undefined]);
	assert.equal(client.getWorkspaceId(), 'ws-c');
});

test('the billing sub-client follows and announces the switch too', () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost', workspaceId: 'ws-a' });
	assert.equal(client.billing.getWorkspaceId(), 'ws-a');
	const seen: Array<string | undefined> = [];
	client.billing.onWorkspaceChange((id) => seen.push(id));
	client.setWorkspaceId('ws-b');
	client.setWorkspaceId('ws-b');
	assert.deepEqual(seen, ['ws-b']);
	assert.equal(client.billing.getWorkspaceId(), 'ws-b');
});

test('a throwing listener does not stop the others', () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	const seen: string[] = [];
	client.onWorkspaceChange(() => {
		throw new Error('boom');
	});
	client.onWorkspaceChange(() => seen.push('second'));
	client.setWorkspaceId('ws-a');
	assert.deepEqual(seen, ['second']);
});
