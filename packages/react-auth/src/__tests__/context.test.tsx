import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AuthClient, FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useLogin, useLogout, useSession } from '../hooks';

const fakeAuth = { marker: 'context-auth' } as unknown as AuthClient;
const fakeClient = { auth: fakeAuth } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('hooks resolve the auth client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useLogin();
	});
	const shape = returned as { login: unknown; isLoading: boolean; error: unknown };
	assert.equal(typeof shape.login, 'function');
	assert.equal(shape.isLoading, false);
	assert.equal(shape.error, null);
});

test('an explicit client still works and bypasses context', () => {
	const explicit = { marker: 'explicit-auth' } as unknown as AuthClient;
	// No provider at all — the explicit argument must be enough.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { logout } = useLogout(explicit);
				assert.equal(typeof logout, 'function');
			},
		}),
	);
});

test('hooks throw a named error without provider or argument', () => {
	assert.throws(
		() =>
			renderToString(
				createElement(Probe, {
					run: () => {
						useSession();
					},
				}),
			),
		/useSession: no client/,
	);
});
