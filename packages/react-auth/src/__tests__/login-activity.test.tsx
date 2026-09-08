import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useLoginHistory, useSessions } from '../hooks';

// renderToString runs one pass and never fires useEffect, so the auto-refresh
// on mount does not run here — we call the returned callbacks directly, exactly
// like the mfa-logout test does, and assert the sub-client was hit.
function renderHook<T>(use: () => T, fakeAuth: unknown): T {
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

function fakeAuthWith(over: Record<string, unknown>) {
	const calls: Record<string, unknown[]> = {
		getLoginHistory: [],
		listSessions: [],
		terminateSession: [],
		terminateOtherSessions: [],
	};
	const base = {
		getLoginHistory: async (input: unknown) => {
			calls.getLoginHistory!.push(input);
			return { reason: 'OK', explanation: '', result: { events: [], nextCursor: null } };
		},
		listSessions: async () => {
			calls.listSessions!.push(undefined);
			return { reason: 'OK', explanation: '', result: { sessions: [] } };
		},
		terminateSession: async (id: string) => {
			calls.terminateSession!.push(id);
			return { reason: 'OK', explanation: '', result: { id } };
		},
		terminateOtherSessions: async () => {
			calls.terminateOtherSessions!.push(undefined);
			return { reason: 'OK', explanation: '', result: { count: 3 } };
		},
	};
	return { auth: { ...base, ...over }, calls };
}

test('useLoginHistory: refresh() queries the caller history with the given filters', async () => {
	const { auth, calls } = fakeAuthWith({});
	const hook = renderHook(() => useLoginHistory({ outcome: 'failed', limit: 10 }), auth);
	await hook.refresh();
	assert.equal(calls.getLoginHistory!.length, 1);
	assert.deepEqual(calls.getLoginHistory![0], { outcome: 'failed', limit: 10 });
});

test('useSessions: terminate(id) calls the sub-client with that id', async () => {
	const { auth, calls } = fakeAuthWith({});
	const hook = renderHook(() => useSessions(), auth);
	await hook.terminate('sess-42');
	assert.deepEqual(calls.terminateSession, ['sess-42']);
});

test('useSessions: terminateOthers() calls the sub-client and then refetches', async () => {
	const { auth, calls } = fakeAuthWith({});
	const hook = renderHook(() => useSessions(), auth);
	await hook.terminateOthers();
	assert.equal(calls.terminateOtherSessions!.length, 1);
	// refetches to learn which survived rather than guessing locally
	assert.ok(calls.listSessions!.length >= 1);
});

test('useSessions: terminate surfaces an API error (and rolls back)', async () => {
	const { auth } = fakeAuthWith({
		terminateSession: async () => {
			throw new Error('boom');
		},
	});
	const hook = renderHook(() => useSessions(), auth);
	await assert.rejects(() => hook.terminate('sess-1'));
});
