import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IAuthConfig } from '../config';
import { requestMeta } from '../services/request-meta';
import { LoginEventModel } from '../models/login-event.model';
import { SessionModel } from '../models/session.model';
import { authController } from '../controllers/auth.controller';

const config: IAuthConfig = {
	jwtSecret: 'kX9mP2qR7vL4wT8nB6yJ3hF5cD1aZ0sQ',
	sessionDuration: '7d',
	providers: ['email'],
};

// Capture every write the code under test issues, for SQL/param assertions.
interface Captured {
	sql: string;
	params: unknown[];
}
function capturingStore(onQuery?: (c: Captured) => unknown[] | undefined): {
	store: IStoreAdapter;
	calls: Captured[];
} {
	const calls: Captured[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			const c = { sql, params: params ?? [] };
			calls.push(c);
			return (onQuery?.(c) ?? []) as unknown as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, calls };
}

function ctxWith(headers: Record<string, string>, clientIp?: string): any {
	return {
		user: null,
		workspace: null,
		tenant: null,
		meta: { body: {}, ...(clientIp ? { clientIp } : {}) },
		request: new Request('http://localhost/', { headers }),
	};
}

// ── requestMeta ──────────────────────────────────────────────────

test('requestMeta: pulls clientIp from meta and UA from headers', () => {
	const m = requestMeta(ctxWith({ 'user-agent': 'Mozilla/5.0 (Macintosh)' }, '203.0.113.7'));
	assert.deepEqual(m, { ipAddress: '203.0.113.7', userAgent: 'Mozilla/5.0 (Macintosh)' });
});

test('requestMeta: null when IP/UA absent (never throws)', () => {
	assert.deepEqual(requestMeta(ctxWith({})), { ipAddress: null, userAgent: null });
});

test('requestMeta: truncates an abusive user-agent to 512 chars', () => {
	const m = requestMeta(ctxWith({ 'user-agent': 'x'.repeat(2000) }, '203.0.113.7'));
	assert.equal(m.userAgent!.length, 512);
});

// ── LoginEventModel ──────────────────────────────────────────────

test('LoginEventModel.record: failed attempt writes all fields', async () => {
	const { store, calls } = capturingStore();
	await new LoginEventModel(store).record({
		userId: null,
		emailAttempted: 'nobody@example.com',
		method: 'password',
		outcome: 'failed',
		failureReason: 'unknown_email',
		ipAddress: '203.0.113.7',
		userAgent: 'UA',
	});
	assert.equal(calls.length, 1);
	assert.match(calls[0]!.sql, /INSERT INTO fonderie_login_events/);
	assert.deepEqual(calls[0]!.params, [
		null,
		'nobody@example.com',
		'password',
		'failed',
		'unknown_email',
		'203.0.113.7',
		'UA',
	]);
});

test('LoginEventModel.record: success defaults failure_reason to null', async () => {
	const { store, calls } = capturingStore();
	await new LoginEventModel(store).record({
		userId: 'u1',
		method: 'mfa',
		outcome: 'success',
		ipAddress: null,
		userAgent: null,
	});
	assert.deepEqual(calls[0]!.params, ['u1', null, 'mfa', 'success', null, null, null]);
});

test('LoginEventModel.recordSafe: a store failure never rejects', async () => {
	const store: IStoreAdapter = {
		query: async () => {
			throw new Error('db down');
		},
		transaction: async (fn) => fn(store),
	};
	// Must not throw synchronously nor reject — history must never break a login.
	new LoginEventModel(store).recordSafe({
		userId: 'u1',
		method: 'password',
		outcome: 'success',
		ipAddress: null,
		userAgent: null,
	});
	await new Promise((r) => setImmediate(r));
	assert.ok(true);
});

// ── SessionModel now persists IP/UA (the bug fix) ─────────────────

test('SessionModel.create: INSERT includes user_agent + ip_address columns and values', async () => {
	const { store, calls } = capturingStore();
	await new SessionModel(store).create('u1', 'tok', new Date('2026-01-01Z'), 'sid-1', {
		ipAddress: '203.0.113.7',
		userAgent: 'UA',
	});
	assert.match(calls[0]!.sql, /INSERT INTO fonderie_sessions .*user_agent, ip_address/s);
	assert.deepEqual(calls[0]!.params.slice(4), ['UA', '203.0.113.7']);
});

test('SessionModel.create: nulls when no meta passed (back-compat)', async () => {
	const { store, calls } = capturingStore();
	await new SessionModel(store).create('u1', 'tok', new Date('2026-01-01Z'), 'sid-1');
	assert.deepEqual(calls[0]!.params.slice(4), [null, null]);
});

// ── Controller: failed login records a 'failed' event ────────────

test('login: unknown email records a failed login event with the attempted email', async () => {
	const inserts: Captured[] = [];
	const { store } = capturingStore((c) => {
		if (c.sql.includes('fonderie_login_events')) inserts.push(c);
		// user lookup returns no rows → unknown email path
		return [];
	});
	const ctrl = authController(store, config);
	const res = await ctrl.login({
		user: null,
		workspace: null,
		tenant: null,
		meta: { body: { email: 'nobody@example.com', password: 'x' }, clientIp: '203.0.113.7' },
		request: new Request('http://localhost/', { headers: { 'user-agent': 'UA' } }),
	} as any);
	assert.equal(res.status, 401);
	// recordSafe is fire-and-forget — let its microtask run.
	await new Promise((r) => setImmediate(r));
	assert.equal(inserts.length, 1);
	assert.equal(inserts[0]!.params[1], 'nobody@example.com');
	assert.equal(inserts[0]!.params[3], 'failed');
	assert.equal(inserts[0]!.params[4], 'unknown_email');
});
