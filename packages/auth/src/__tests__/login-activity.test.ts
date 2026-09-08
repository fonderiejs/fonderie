import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';
import type { IAuthConfig } from '../config';
import { requestMeta } from '../services/request-meta';
import { LoginEventModel } from '../models/login-event.model';
import { SessionModel } from '../models/session.model';
import { authController } from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';

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

// ── LoginEventModel.listByUser (pagination) ──────────────────────

function eventRow(id: string, createdAt: string) {
	return {
		id,
		method: 'password',
		outcome: 'success',
		failureReason: null,
		ipAddress: null,
		userAgent: null,
		createdAt: new Date(createdAt),
		createdAtRaw: createdAt,
	};
}

test('listByUser: over-fetches limit+1 and reports hasMore, trimming to the page', async () => {
	let sentLimit: number | undefined;
	const { store } = capturingStore((c) => {
		sentLimit = c.params[c.params.length - 1] as number;
		// Return limit+1 rows so hasMore is true.
		return [eventRow('a', '2026-01-03 00:00:00+00'), eventRow('b', '2026-01-02 00:00:00+00'), eventRow('c', '2026-01-01 00:00:00+00')];
	});
	const page = await new LoginEventModel(store).listByUser({ userId: 'u1', limit: 2 });
	assert.equal(sentLimit, 3, 'SQL LIMIT is page size + 1');
	assert.equal(page.events.length, 2, 'trimmed to the requested page size');
	assert.equal(page.hasMore, true);
});

test('listByUser: outcome filter and cursor both add WHERE predicates', async () => {
	let captured = '';
	const { store } = capturingStore((c) => {
		captured = c.sql;
		return [];
	});
	await new LoginEventModel(store).listByUser({
		userId: 'u1',
		outcome: 'failed',
		cursor: { createdAt: '2026-01-02 00:00:00+00', id: '11111111-1111-1111-1111-111111111111' },
	});
	assert.match(captured, /outcome = \$2/);
	assert.match(captured, /\(created_at, id\) < \(/);
});

// ── SessionModel terminate scoping ───────────────────────────────

test('terminateById: scopes the DELETE to the owner and returns whether a row went', async () => {
	let captured: Captured | undefined;
	const { store } = capturingStore((c) => {
		captured = c;
		return [{ id: 's1' }]; // one row deleted
	});
	const ok = await new SessionModel(store).terminateById('u1', 's1');
	assert.equal(ok, true);
	assert.match(captured!.sql, /DELETE FROM fonderie_sessions WHERE id = \$1 AND user_id = \$2/);
	assert.deepEqual(captured!.params, ['s1', 'u1']);
});

test('terminateOthers: spares the current sid and counts the rest', async () => {
	let captured: Captured | undefined;
	const { store } = capturingStore((c) => {
		captured = c;
		return [{ id: 'x' }, { id: 'y' }];
	});
	const n = await new SessionModel(store).terminateOthers('u1', 'sid-current');
	assert.equal(n, 2);
	assert.match(captured!.sql, /sid IS DISTINCT FROM \$2/);
	assert.deepEqual(captured!.params, ['u1', 'sid-current']);
});

// ── Controller: sessions handlers ────────────────────────────────

function userCtx(over: Record<string, unknown> = {}): any {
	return {
		user: { id: 'u1', email: 'u1@example.com', phoneVerified: false, sid: 'sid-current', ...over },
		workspace: null,
		tenant: null,
		meta: {},
		request: new Request('http://localhost/auth/sessions'),
	};
}

test('listSessions: flags the row whose sid matches the current session', async () => {
	const { store } = capturingStore((c) => {
		if (c.sql.includes('FROM fonderie_sessions') && c.sql.includes('expires_at > now()')) {
			return [
				{ id: 's1', sid: 'sid-current', userAgent: 'UA', ipAddress: '1.1.1.1', createdAt: new Date(), expiresAt: new Date() },
				{ id: 's2', sid: 'sid-other', userAgent: 'UA2', ipAddress: '2.2.2.2', createdAt: new Date(), expiresAt: new Date() },
			];
		}
		return [];
	});
	const res = await userController(store, config).listSessions(userCtx());
	const body: any = await res.json();
	assert.equal(res.status, 200);
	const [a, b] = body.result.sessions;
	assert.equal(a.current, true);
	assert.equal(b.current, false);
});

test('terminateOtherSessions: 422 when there is no current session to spare', async () => {
	const { store } = capturingStore();
	const res = await userController(store, config).terminateOtherSessions(userCtx({ sid: null }));
	assert.equal(res.status, 422);
});

test('terminateSession: 404 when the id belongs to no session of the caller', async () => {
	const { store } = capturingStore(() => []); // DELETE ... RETURNING → no rows
	const ctx = userCtx();
	ctx.meta.params = { id: 'not-mine' };
	const res = await userController(store, config).terminateSession(ctx);
	assert.equal(res.status, 404);
});

// ── logout kills the authenticated session by sid ────────────────

test('logout: deletes the current session by sid (no refresh token needed)', async () => {
	const deletes: Captured[] = [];
	const { store } = capturingStore((c) => {
		if (c.sql.includes('DELETE FROM fonderie_sessions')) deletes.push(c);
		return [];
	});
	const ctrl = authController(store, config);
	const res = await ctrl.logout({
		user: { id: 'u1', email: 'u1@example.com', sid: 'sid-current' },
		workspace: null,
		tenant: null,
		meta: { body: {} },
		request: new Request('http://localhost/auth/logout'),
	} as any);
	assert.equal(res.status, 200);
	// A DELETE by sid must have run with the request's sid.
	const bySid = deletes.find((d) => /WHERE sid = \$1/.test(d.sql));
	assert.ok(bySid, 'logout deletes the session by sid');
	assert.deepEqual(bySid!.params, ['sid-current']);
});
