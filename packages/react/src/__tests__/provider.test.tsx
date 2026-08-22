import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { FonderieProvider, useFonderieClient, useFonderieSubClient } from '../provider';

const fakeAuth = { marker: 'context-auth' };
const fakeClient = { auth: fakeAuth } as unknown as FonderieClient;

function Probe({ onResolve }: { onResolve: (value: unknown) => void }) {
	onResolve(useFonderieClient());
	return null;
}

test('useFonderieClient resolves the client from the provider', () => {
	let resolved: unknown;
	renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { onResolve: (v) => (resolved = v) })),
	);
	assert.equal(resolved, fakeClient);
});

test('useFonderieClient throws without a provider', () => {
	assert.throws(
		() => renderToString(createElement(Probe, { onResolve: () => {} })),
		/FonderieProvider/,
	);
});

function SubProbe({ explicit, onResolve }: { explicit?: unknown; onResolve: (value: unknown) => void }) {
	onResolve(useFonderieSubClient(explicit, (c) => (c as unknown as { auth: unknown }).auth, 'useProbe'));
	return null;
}

test('useFonderieSubClient falls back to context', () => {
	let resolved: unknown;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: fakeClient },
			createElement(SubProbe, { onResolve: (v) => (resolved = v) }),
		),
	);
	assert.equal(resolved, fakeAuth);
});

test('useFonderieSubClient prefers the explicit argument over context', () => {
	const override = { marker: 'explicit-auth' };
	let resolved: unknown;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: fakeClient },
			createElement(SubProbe, { explicit: override, onResolve: (v) => (resolved = v) }),
		),
	);
	assert.equal(resolved, override);
});

test('useFonderieSubClient throws a hook-named error when neither is present', () => {
	assert.throws(
		() => renderToString(createElement(SubProbe, { onResolve: () => {} })),
		/useProbe: no client/,
	);
});
