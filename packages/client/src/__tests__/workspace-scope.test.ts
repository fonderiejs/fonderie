import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieClient } from '../index';

// Every workspace-scoped sub-client reports its scope, so hooks can follow a
// switch. Only billing did; members, roles, customers, audit and webhooks
// screens kept the previous workspace's data.
test('every workspace-scoped sub-client reports the scope and its changes', () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', workspaceId: 'ws-a' });
	for (const name of ['billing', 'workspaces', 'customers', 'audit', 'webhooks'] as const) {
		const sub = client[name];
		assert.equal(sub.getWorkspaceId(), 'ws-a', `${name} starts on the client's workspace`);
		const seen: Array<string | undefined> = [];
		const off = sub.onWorkspaceChange((id) => seen.push(id));
		client.setWorkspaceId('ws-b');
		client.setWorkspaceId('ws-b'); // unchanged: no second notice
		off();
		client.setWorkspaceId('ws-c'); // unsubscribed
		assert.deepEqual(seen, ['ws-b'], name);
		client.setWorkspaceId('ws-a');
	}
});

test('a sub-client built without its constructor (a test double) still answers', async () => {
	const { WorkspacesClient } = await import('../index');
	const fake = Object.create(WorkspacesClient.prototype) as InstanceType<typeof WorkspacesClient>;
	const off = fake.onWorkspaceChange(() => {});
	assert.equal(typeof off, 'function');
	assert.equal(fake.getWorkspaceId(), undefined);
});
