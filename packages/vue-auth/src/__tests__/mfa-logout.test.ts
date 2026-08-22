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

const calls: {
	login: unknown[];
	logout: (string | undefined)[];
	setAccessToken: unknown[];
	getUser: number;
	sendVerificationEmail: number;
	deleteUser: number;
	mfaVerify: string[];
} = {
	login: [],
	logout: [],
	setAccessToken: [],
	getUser: 0,
	sendVerificationEmail: 0,
	deleteUser: 0,
	mfaVerify: [],
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
	getUser: async () => {
		calls.getUser += 1;
		return { reason: 'OK', explanation: '', result: { user: { id: 'u1' } } };
	},
	sendVerificationEmail: async () => {
		calls.sendVerificationEmail += 1;
		return { reason: 'OK', explanation: '', result: undefined };
	},
	deleteUser: async () => {
		calls.deleteUser += 1;
		return { reason: 'OK', explanation: '', result: undefined };
	},
	mfa: {
		verify: async (code: string) => {
			calls.mfaVerify.push(code);
			return {
				reason: 'OK',
				explanation: '',
				result: { tokens: { access: 'acc-rotated', refresh: 'ref-rotated' }, backupCodes: [] },
			};
		},
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


test('isMfaRequired and IMfaRequiredResult are re-exported from the package index', async () => {
	const index = await import('../index');
	assert.equal(typeof index.isMfaRequired, 'function');
	assert.equal(index.isMfaRequired({ mfaToken: 'x' } as never), true);
});


test('useMfaLogin persists tokens exactly like a full login', async () => {
	loginResult = null;
	calls.setAccessToken.length = 0;
	const verifyCalls: unknown[] = [];
	Object.assign((fakeAuth as unknown as { mfa: object }).mfa, {
		verifyLogin: async (mfaToken: string, code: string) => {
			verifyCalls.push([mfaToken, code]);
			return {
				reason: 'OK',
				explanation: '',
				result: { tokens: { access: 'acc-mfa', refresh: 'ref-mfa' }, user: { id: 'u1' } },
			};
		},
	});
	const { useMfaLogin } = await import('../index');
	const { verifyLogin } = await renderComposable(() => useMfaLogin());
	const result = await verifyLogin('mfa-temp-1', '123456');
	assert.deepEqual(verifyCalls, [['mfa-temp-1', '123456']]);
	assert.deepEqual(calls.setAccessToken, ['acc-mfa'], 'MFA completion must arm the client token');
	assert.equal(result.tokens.access, 'acc-mfa');
});

test('useMfaSetup.verify persists the rotated tokens like a login', async () => {
	calls.setAccessToken.length = 0;
	calls.mfaVerify.length = 0;
	const { useMfaSetup } = await import('../index');
	const { verify } = await renderComposable(() => useMfaSetup());
	const result = await verify('654321');
	assert.deepEqual(calls.mfaVerify, ['654321']);
	assert.deepEqual(calls.setAccessToken, ['acc-rotated'], 'rotated tokens must re-arm the client');
	assert.equal((result as { tokens: { access: string } }).tokens.access, 'acc-rotated');
});

test('useAccountData.deleteUser deletes the account then tears the session down', async () => {
	calls.setAccessToken.length = 0;
	calls.deleteUser = 0;
	const { useAccountData } = await import('../index');
	const { deleteUser } = await renderComposable(() => useAccountData());
	await deleteUser();
	assert.equal(calls.deleteUser, 1);
	assert.deepEqual(calls.setAccessToken, [undefined], 'the client token must be cleared');
});

test('useVerifyEmail.resend re-sends the verification email and sets resent', async () => {
	calls.sendVerificationEmail = 0;
	const { useVerifyEmail } = await import('../index');
	const { resend, resent } = await renderComposable(() => useVerifyEmail());
	assert.equal(resent.value, false);
	await resend();
	assert.equal(calls.sendVerificationEmail, 1);
	assert.equal(resent.value, true);
});

test('useProfile fetches on setup and again on refresh()', async () => {
	calls.getUser = 0;
	const { useProfile } = await import('../index');
	const { user, refresh } = await renderComposable(() => useProfile());
	// The composable kicks off one fetch during setup(); let it settle.
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(calls.getUser, 1, 'setup() must fetch the profile once');
	await refresh();
	assert.equal(calls.getUser, 2);
	assert.deepEqual(user.value, { id: 'u1' });
});

test('storage primitives are exported from the package index', async () => {
	const index = await import('../index');
	assert.equal(typeof index.persistToken, 'function');
	assert.equal(typeof index.clearToken, 'function');
	assert.equal(typeof index.readToken, 'function');
	assert.equal(index.TOKEN_KEY, 'fonderie_access_token');
});
