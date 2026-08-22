import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AuthClient, FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useLogin, useLogout } from '../hooks';

function renderHook<T>(use: () => T): T {
	let value: T | undefined;
	function Probe() {
		value = use();
		return null;
	}
	renderToString(
		createElement(
			FonderieProvider,
			{ client: { auth: fakeAuth } as unknown as FonderieClient },
			createElement(Probe),
		),
	);
	return value as T;
}

const calls: { login: unknown[]; logout: (string | undefined)[]; setAccessToken: unknown[] } = {
	login: [],
	logout: [],
	setAccessToken: [],
};
let loginResult: unknown;
const fakeAuth = {
	login: async (input: unknown) => {
		calls.login.push(input);
		return { reason: 'OK', explanation: '', result: loginResult };
	},
	logout: async (refreshToken?: string) => {
		calls.logout.push(refreshToken);
		return { reason: 'OK', explanation: '', result: undefined };
	},
	setAccessToken: (token: unknown) => {
		calls.setAccessToken.push(token);
	},
} as unknown as AuthClient;

test('login persists tokens on a full login result', async () => {
	loginResult = { tokens: { access: 'acc-1', refresh: 'ref-1' }, user: { id: 'u1' } };
	calls.setAccessToken.length = 0;
	const { login } = renderHook(() => useLogin());
	const result = await login({ email: 'a@b.c', password: 'x' });
	assert.deepEqual(calls.setAccessToken, ['acc-1']);
	assert.equal((result as { tokens: { access: string } }).tokens.access, 'acc-1');
});

test('login with MFA_REQUIRED returns mfaToken and does NOT touch tokens', async () => {
	loginResult = { mfaToken: 'mfa-temp-1' };
	calls.setAccessToken.length = 0;
	const { login } = renderHook(() => useLogin());
	const result = await login({ email: 'a@b.c', password: 'x' });
	assert.deepEqual(calls.setAccessToken, [], 'setAccessToken must not be called before MFA completes');
	assert.equal((result as { mfaToken: string }).mfaToken, 'mfa-temp-1');
});

test('mfaPending starts null and the hook exposes it', () => {
	const returned = renderHook(() => useLogin());
	assert.equal(returned.mfaPending, null);
});

test('logout passes the refresh token through for server-side revocation', async () => {
	calls.logout.length = 0;
	const { logout } = renderHook(() => useLogout());
	await logout('refresh-abc');
	assert.deepEqual(calls.logout, ['refresh-abc']);
});

test('logout with no argument still works', async () => {
	calls.logout.length = 0;
	const { logout } = renderHook(() => useLogout());
	await logout();
	assert.deepEqual(calls.logout, [undefined]);
});
