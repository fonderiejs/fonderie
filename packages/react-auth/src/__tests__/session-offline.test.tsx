import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieApiError, type AuthClient, type FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useSession } from '../hooks';

// Node has no localStorage; the web storage helpers need one.
(globalThis as { localStorage?: unknown }).localStorage ??= { setItem() {}, getItem: () => null, removeItem() {} };

// docs/SESSION-DESIGN.md, Phase 4: a session check that fails because the
// phone is offline must not sign the user out. Only a refusal does.
function fakeAuth(failure: unknown) {
	const cleared: Array<string | undefined> = [];
	const auth = {
		getUser: async () => {
			throw failure;
		},
		setAccessToken: (t: string | undefined) => cleared.push(t),
		hasAccessToken: () => true,
	} as unknown as AuthClient;
	return { auth, cleared };
}

function sessionWith(auth: AuthClient) {
	let value: ReturnType<typeof useSession> | undefined;
	function Probe() {
		value = useSession();
		return null;
	}
	renderToString(createElement(FonderieProvider, { client: { auth } as unknown as FonderieClient }, createElement(Probe)));
	return value!;
}

test('useSession: offline (the request never reached the server) keeps the session', async () => {
	const { auth, cleared } = fakeAuth(new TypeError('Network request failed'));
	await sessionWith(auth).refresh();
	assert.deepEqual(cleared, [], 'the token was not cleared');
});

test('useSession: a 5xx keeps the session', async () => {
	const { auth, cleared } = fakeAuth(new FonderieApiError('UNAVAILABLE', 'down', 503));
	await sessionWith(auth).refresh();
	assert.deepEqual(cleared, []);
});

test('useSession: the server refusing the session signs out', async () => {
	const { auth, cleared } = fakeAuth(new FonderieApiError('UNAUTHORIZED', 'expired', 401));
	await sessionWith(auth).refresh();
	assert.deepEqual(cleared, [undefined]);
});
