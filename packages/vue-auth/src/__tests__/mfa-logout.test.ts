import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AuthClient, FonderieClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useLogin, useLogout } from '../composables';

// Node has no localStorage; the composable's persistToken needs one.
(globalThis as { localStorage?: unknown }).localStorage ??= {
	setItem() {},
	getItem: () => null,
	removeItem() {},
};

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
const fakeClient = { auth: fakeAuth } as unknown as FonderieClient;

async function renderComposable<T>(use: () => T): Promise<T> {
	let value: T | undefined;
	const Probe = defineComponent({
		setup() {
			value = use();
			return () => h('div');
		},
	});
	const app = createSSRApp(Probe);
	app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return value as T;
}

test('login persists tokens on a full login result', async () => {
	loginResult = { tokens: { access: 'acc-1', refresh: 'ref-1' }, user: { id: 'u1' } };
	calls.setAccessToken.length = 0;
	const { login } = await renderComposable(() => useLogin());
	const result = await login({ email: 'a@b.c', password: 'x' });
	assert.deepEqual(calls.setAccessToken, ['acc-1']);
	assert.equal((result as { tokens: { access: string } }).tokens.access, 'acc-1');
});

test('login with MFA_REQUIRED sets mfaPending and does NOT touch tokens', async () => {
	loginResult = { mfaToken: 'mfa-temp-1' };
	calls.setAccessToken.length = 0;
	const { login, mfaPending } = await renderComposable(() => useLogin());
	const result = await login({ email: 'a@b.c', password: 'x' });
	assert.deepEqual(calls.setAccessToken, [], 'setAccessToken must not be called before MFA completes');
	assert.equal((result as { mfaToken: string }).mfaToken, 'mfa-temp-1');
	assert.equal(mfaPending.value?.mfaToken, 'mfa-temp-1');
});

test('logout passes the refresh token through for server-side revocation', async () => {
	calls.logout.length = 0;
	const { logout } = await renderComposable(() => useLogout());
	await logout('refresh-abc');
	assert.deepEqual(calls.logout, ['refresh-abc']);
});

test('logout with no argument still works', async () => {
	calls.logout.length = 0;
	const { logout } = await renderComposable(() => useLogout());
	await logout();
	assert.deepEqual(calls.logout, [undefined]);
});
