import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AuthClient, FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useAppleSignIn, useGoogleSignIn } from '../hooks';

// Native social sign-in answers like a password login: a session, or — when
// the account has MFA — { mfaToken } and NO session until the second factor.

function fakeAuth(answer: unknown) {
	const calls = { google: [] as unknown[], apple: [] as unknown[], tokens: [] as unknown[] };
	const auth = {
		googleNative: async (input: unknown) => {
			calls.google.push(input);
			return { reason: 'X', explanation: '', result: answer };
		},
		appleNative: async (input: unknown) => {
			calls.apple.push(input);
			return { reason: 'X', explanation: '', result: answer };
		},
		setAccessToken: (t: unknown) => calls.tokens.push(t),
	} as unknown as AuthClient;
	return { auth, calls };
}

function hooks(auth: AuthClient) {
	let google!: ReturnType<typeof useGoogleSignIn>;
	let apple!: ReturnType<typeof useAppleSignIn>;
	function Probe() {
		google = useGoogleSignIn();
		apple = useAppleSignIn();
		return null;
	}
	renderToString(createElement(FonderieProvider, { client: { auth } as unknown as FonderieClient }, createElement(Probe)));
	return { google, apple };
}

const SESSION = { tokens: { access: 'acc', refresh: 'ref' }, user: { id: 'u1' } };

test('useGoogleSignIn: relays the ID token and stores the session', async () => {
	const { auth, calls } = fakeAuth(SESSION);
	const result = await hooks(auth).google.signIn({ idToken: 'google-id-token' });
	assert.deepEqual(calls.google, [{ idToken: 'google-id-token' }]);
	assert.deepEqual(calls.tokens, ['acc']);
	assert.equal((result as typeof SESSION).tokens.access, 'acc');
});

test('Google and Apple: an account with MFA gets { mfaToken } and no session', async () => {
	for (const which of ['google', 'apple'] as const) {
		const { auth, calls } = fakeAuth({ mfaToken: 'pending' });
		const h = hooks(auth);
		const result = which === 'google' ? await h.google.signIn({ idToken: 't' }) : await h.apple.signIn({ identityToken: 't' });
		assert.deepEqual(result, { mfaToken: 'pending' }, which);
		assert.deepEqual(calls.tokens, [], `${which}: no token stored before the second factor`);
	}
});
