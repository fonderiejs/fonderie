import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { FonderieClient, type IAuthErrorInfo, type SessionState } from '../index';

// docs/SESSION-DESIGN.md, Phase 4: only the server saying no ends a session.
// A phone in a tunnel used to be signed out because a refresh that never
// reached the server was treated like a refused one.

type RefreshMode = 'ok' | 'refuse' | 'unavailable' | 'drop';

async function api(mode: { refresh: RefreshMode }) {
	const server: Server = createServer((req, res) => {
		if (req.url === '/auth/refresh') {
			if (mode.refresh === 'drop') return req.socket.destroy();
			if (mode.refresh === 'unavailable') {
				res.writeHead(503, { 'content-type': 'application/json' });
				return res.end(JSON.stringify({ reason: 'UNAVAILABLE', explanation: 'down' }));
			}
			if (mode.refresh === 'refuse') {
				res.writeHead(401, { 'content-type': 'application/json' });
				return res.end(JSON.stringify({ reason: 'REFRESH_TOKEN_REUSED', explanation: 'no' }));
			}
			res.writeHead(200, { 'content-type': 'application/json' });
			return res.end(JSON.stringify({ reason: 'TOKEN_REFRESHED', explanation: 'ok', result: { tokens: { access: 'new', refresh: 'r2' } } }));
		}
		const ok = req.headers.authorization === 'Bearer new';
		res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
		res.end(JSON.stringify(ok ? { reason: 'OK', explanation: 'ok', result: { n: 1 } } : { reason: 'UNAUTHORIZED', explanation: 'expired' }));
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return { url, close: () => new Promise<void>((r) => server.close(() => r())) };
}

function client(url: string, errors: IAuthErrorInfo[], states: SessionState[]) {
	const c = new FonderieClient({
		baseUrl: url,
		accessToken: 'old',
		auth: { getRefreshToken: () => 'r1', onTokensChanged: () => {}, onAuthError: (info) => errors.push(info) },
	});
	c.onSessionChange((s) => states.push(s));
	return c;
}
const token = (c: FonderieClient) => (c as unknown as { tokens: { get(): string | undefined } }).tokens.get();

test('a refused refresh ends the session: revoked, tokens cleared, onAuthError says why', async () => {
	const srv = await api({ refresh: 'refuse' });
	const errors: IAuthErrorInfo[] = [];
	const states: SessionState[] = [];
	const c = client(srv.url, errors, states);
	try {
		assert.equal(c.session, 'active');
		await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
		assert.equal(c.session, 'revoked');
		assert.equal(token(c), undefined);
		assert.deepEqual(errors, [{ reason: 'expired', detail: 'REFRESH_TOKEN_REUSED' }]);
	} finally {
		await srv.close();
	}
});

test('a refresh that never reached the server keeps the session: offline, token kept, no sign-out', async () => {
	const mode = { refresh: 'drop' as RefreshMode };
	const srv = await api(mode);
	const errors: IAuthErrorInfo[] = [];
	const states: SessionState[] = [];
	const c = client(srv.url, errors, states);
	try {
		await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
		assert.equal(c.session, 'offline');
		assert.equal(token(c), 'old', 'the session survives');
		assert.deepEqual(errors, [], 'never told to sign out');
		// Back in signal: the next request refreshes and the session is active again.
		mode.refresh = 'ok';
		const res = await c.request<{ n: number }>({ method: 'GET', path: '/things' });
		assert.equal(res.result.n, 1);
		assert.equal(c.session, 'active');
		assert.equal(token(c), 'new');
	} finally {
		await srv.close();
	}
});

test('a 5xx from the refresh endpoint is not a verdict on the session', async () => {
	const srv = await api({ refresh: 'unavailable' });
	const errors: IAuthErrorInfo[] = [];
	const c = client(srv.url, errors, []);
	try {
		await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
		assert.notEqual(c.session, 'revoked');
		assert.equal(token(c), 'old');
		assert.deepEqual(errors, []);
	} finally {
		await srv.close();
	}
});

test('a server that cannot be reached at all: offline while signed in, active when it answers again', async () => {
	const srv = await api({ refresh: 'ok' });
	const states: SessionState[] = [];
	const c = new FonderieClient({ baseUrl: 'http://127.0.0.1:1', accessToken: 'new' });
	c.onSessionChange((s) => states.push(s));
	try {
		await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
		assert.equal(c.session, 'offline');
		const back = new FonderieClient({ baseUrl: srv.url, accessToken: 'new' });
		await back.request({ method: 'GET', path: '/things' });
		assert.equal(back.session, 'active');
		assert.deepEqual(states, ['offline']);
	} finally {
		await srv.close();
	}
});

test('signed out stays signedOut whatever the network does; signing in makes it active', async () => {
	const c = new FonderieClient({ baseUrl: 'http://127.0.0.1:1' });
	assert.equal(c.session, 'signedOut');
	await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
	assert.equal(c.session, 'signedOut');
	c.setAccessToken('new');
	assert.equal(c.session, 'active');
	c.setAccessToken(undefined);
	assert.equal(c.session, 'signedOut', 'a plain sign-out is not a revocation');
});

test('no refresh token: the session ends with that reason', async () => {
	const srv = await api({ refresh: 'ok' });
	const errors: IAuthErrorInfo[] = [];
	const c = new FonderieClient({ baseUrl: srv.url, accessToken: 'old', auth: { getRefreshToken: () => undefined, onAuthError: (i) => errors.push(i) } });
	try {
		await assert.rejects(() => c.request({ method: 'GET', path: '/things' }));
		assert.equal(c.session, 'revoked');
		assert.deepEqual(errors, [{ reason: 'no-refresh-token' }]);
	} finally {
		await srv.close();
	}
});
