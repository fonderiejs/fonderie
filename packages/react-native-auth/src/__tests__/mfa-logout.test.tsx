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

const calls: {
	login: unknown[];
	logout: (string | undefined)[];
	setAccessToken: unknown[];
	getUser: unknown[];
	deleteUser: unknown[];
	sendVerificationEmail: unknown[];
} = {
	login: [],
	logout: [],
	setAccessToken: [],
	getUser: [],
	deleteUser: [],
	sendVerificationEmail: [],
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
		calls.getUser.push(undefined);
		return { reason: 'OK', explanation: '', result: { user: { id: 'u1' } } };
	},
	deleteUser: async () => {
		calls.deleteUser.push(undefined);
		return { reason: 'OK', explanation: '', result: undefined };
	},
	sendVerificationEmail: async () => {
		calls.sendVerificationEmail.push(undefined);
		return { reason: 'OK', explanation: '', result: undefined };
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


test('isMfaRequired and IMfaRequiredResult are re-exported from the package index', async () => {
	const index = await import('../index');
	assert.equal(typeof index.isMfaRequired, 'function');
	assert.equal(index.isMfaRequired({ mfaToken: 'x' } as never), true);
});


test('useMfaLogin persists tokens exactly like a full login', async () => {
	loginResult = null;
	calls.setAccessToken.length = 0;
	const verifyCalls: unknown[] = [];
	(fakeAuth as unknown as { mfa: unknown }).mfa = {
		verifyLogin: async (mfaToken: string, code: string) => {
			verifyCalls.push([mfaToken, code]);
			return {
				reason: 'OK',
				explanation: '',
				result: { tokens: { access: 'acc-mfa', refresh: 'ref-mfa' }, user: { id: 'u1' } },
			};
		},
	};
	const { useMfaLogin } = await import('../index');
	const { verifyLogin } = renderHook(() => useMfaLogin());
	const result = await verifyLogin('mfa-temp-1', '123456');
	assert.deepEqual(verifyCalls, [['mfa-temp-1', '123456']]);
	assert.deepEqual(calls.setAccessToken, ['acc-mfa'], 'MFA completion must arm the client token');
	assert.equal(result.tokens.access, 'acc-mfa');
});

test('storage primitives are exported from the package index', async () => {
	const index = await import('../index');
	assert.equal(typeof index.persistToken, 'function');
	assert.equal(typeof index.clearToken, 'function');
	assert.equal(typeof index.readToken, 'function');
	assert.equal(index.TOKEN_KEY, 'fonderie_access_token');
});


test('useMfaSetup.verify completes enrollment without touching the session token', async () => {
	// The server does NOT rotate tokens on setup confirmation — MFA is enforced
	// at login, so the current session stays valid unchanged.
	calls.setAccessToken.length = 0;
	const verifyCalls: unknown[] = [];
	const authWithMfa = fakeAuth as unknown as { mfa?: Record<string, unknown> };
	authWithMfa.mfa = authWithMfa.mfa ?? {};
	const mfa = authWithMfa.mfa;
	mfa.verify = async (code: string) => {
		verifyCalls.push([code]);
		return { reason: 'MFA_ENABLED', explanation: '', result: { mfaEnabled: true } };
	};
	const { useMfaSetup } = await import('../index');
	const { verify } = renderHook(() => useMfaSetup());
	const result = await verify('123456');
	assert.deepEqual(verifyCalls, [['123456']]);
	assert.deepEqual(calls.setAccessToken, [], 'enrollment must not rotate the session token');
	assert.equal(result.mfaEnabled, true);
});

test('useProfile.refresh loads the user through the client', async () => {
	calls.getUser.length = 0;
	const { useProfile } = await import('../index');
	// renderToString does not run effects — drive the initial fetch manually.
	const { refresh } = renderHook(() => useProfile());
	await refresh();
	assert.equal(calls.getUser.length, 1);
});

test('useAccountData.deleteUser tears the session down after deletion', async () => {
	calls.deleteUser.length = 0;
	calls.setAccessToken.length = 0;
	const { useAccountData } = await import('../index');
	const { deleteUser } = renderHook(() => useAccountData());
	await deleteUser();
	assert.equal(calls.deleteUser.length, 1);
	assert.deepEqual(calls.setAccessToken, [undefined], 'deletion must disarm the client token');
});

test('useVerifyEmail.resend re-sends the verification email', async () => {
	calls.sendVerificationEmail.length = 0;
	const { useVerifyEmail } = await import('../index');
	const { resend } = renderHook(() => useVerifyEmail());
	await resend();
	assert.equal(calls.sendVerificationEmail.length, 1);
});
