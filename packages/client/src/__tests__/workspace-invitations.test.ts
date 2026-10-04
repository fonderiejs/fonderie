import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FonderieClient } from '../index';

// The prebuilt accept screens hand over the LINK's token. acceptInvitation used
// to send every code as { pin }, so a link could never be accepted.
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function capture(): Array<{ url: string; method: string; body: unknown }> {
	const calls: Array<{ url: string; method: string; body: unknown }> = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		calls.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : undefined });
		return new Response(JSON.stringify({ status: 200, reason: 'OK', result: { workspaceId: 'ws-1' } }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	}) as typeof fetch;
	return calls;
}

test('acceptInvitation sends a token as a token and a PIN as a PIN', async () => {
	const calls = capture();
	const { workspaces } = new FonderieClient({ baseUrl: 'http://api.test' });
	await workspaces.acceptInvitation({ token: 'aaaa-bbbb-cccc-dddd-eeee-ffff-gggg-hhhh' });
	await workspaces.acceptInvitation({ pin: '123456' });
	await workspaces.acceptInvitation('654321');
	assert.deepEqual(
		calls.map((c) => c.body),
		[{ token: 'aaaa-bbbb-cccc-dddd-eeee-ffff-gggg-hhhh' }, { pin: '123456' }, { pin: '654321' }],
	);
	assert.ok(calls.every((c) => c.method === 'POST' && c.url === 'http://api.test/workspaces/invitations/accept'));
});

test('the ownership and invitation actions reach their routes', async () => {
	const calls = capture();
	const { workspaces } = new FonderieClient({ baseUrl: 'http://api.test', workspaceId: 'ws-1' });
	await workspaces.resendInvitation('inv 1');
	await workspaces.setManager('u1');
	await workspaces.unsetManager('u1');
	await workspaces.transferOwnership('u2');
	await workspaces.leaveWorkspace();
	await workspaces.getCurrentWorkspace();
	assert.deepEqual(
		calls.map((c) => `${c.method} ${c.url.replace('http://api.test', '')}`),
		[
			'POST /workspaces/invitations/inv%201/resend',
			'POST /workspaces/members/u1/manager',
			'DELETE /workspaces/members/u1/manager',
			'POST /workspaces/transfer-ownership',
			'POST /workspaces/leave',
			'GET /workspaces/current',
		],
	);
	assert.deepEqual(calls[3]!.body, { userId: 'u2' });
});
