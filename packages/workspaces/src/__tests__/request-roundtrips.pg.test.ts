import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { requireAuth as requireAuthMw } from '@fonderie/core/middlewares';

import { WorkspacesModule } from '../module';
import { withWorkspace as withWorkspaceMw } from '../middlewares/workspace-context';
import { requireManager } from '../middlewares/require-manager';
import { getMigrationsPath } from '../migrations';
import { MESSAGE_KEYS } from '../config';

// How many round-trips to Postgres one ordinary authenticated, workspace-scoped
// request costs, on a REAL Postgres, over HTTP, through the whole stack an app
// assembles: withSession (session liveness + user) → withBilling (membership
// for the header-named workspace, subscription, windowed counters) →
// withWorkspace (workspace + membership) → requireManager → requirePermission.
// A counting store wraps the one every module shares; the number is printed
// and held under a ceiling so a new per-request query is a decision, not drift.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'roundtrips.acme.example';

// Before the round-trip pass (counted by this test on the same requests): the
// owner's manager+permission route cost 11 queries, the member's permission
// route 12. Per request: session 1 + user 1, billing membership 1 +
// subscription 1 + one upsert per windowed counter (3 here), workspace 1 +
// membership 1, then the permission engine's membership, super-role and
// system-role reads (2–3; a stored grant adds a 4th).
const BEFORE = { owner: 11, member: 12 };
const CEILING = { owner: 6, member: 6 };

let inner: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

// Every statement, inside a transaction or not, while `counting` is on.
let counting = false;
const seen: string[] = [];
function counted(s: IStoreAdapter): IStoreAdapter {
	return {
		query: async <T = unknown>(sql: string, params?: unknown[]) => {
			if (counting) seen.push(sql.replace(/\s+/g, ' ').trim().slice(0, 110));
			return s.query<T>(sql, params);
		},
		transaction: <T>(fn: (tx: IStoreAdapter) => Promise<T>) => s.transaction((tx) => fn(counted(tx))),
	};
}

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
	const { PermissionsModule, requirePermission } = await import('@fonderie/permissions');
	const { getMigrationsPath: permMigrations } = await import('@fonderie/permissions/migrations');
	const { BillingModule } = await import('@fonderie/billing');
	const { getMigrationsPath: billingMigrations } = await import('@fonderie/billing/migrations');
	inner = new PGAdapter(PG_URL) as typeof inner;
	for (const m of [authMigrations(), getMigrationsPath(), permMigrations(), billingMigrations()]) {
		await new InternalMigrationRunner(inner, m).run();
	}
	const store = counted(inner);
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new PermissionsModule(store, {
			superRole: 'ADMIN',
			catalog: [{ key: 'reports', operations: ['read'] }],
			systemGrants: { GUEST: { reports: ['read'] } },
		}))
		.register(new WorkspacesModule(store, { personalWorkspace: false, invitationUrl: 'https://app.acme.example/invite/{token}' }, bus as never))
		.register(new BillingModule(store, {
			provider: { name: 'fake' },
			successUrl: 'https://app.acme.example/ok',
			cancelUrl: 'https://app.acme.example/cancel',
			rateLimit: { backend: 'db' },
			plans: [{
				name: 'roundtrip-free',
				policy: {
					apiCalls: { limit: 100000, window: '1d' },
					exports: { limit: 100000, window: '30d' },
					searches: { limit: 100000, window: '1h' },
				},
			}],
		} as never))
		.register({
			name: 'test-reports',
			install(a: { addRoute: (m: string, p: string, ...h: unknown[]) => void }) {
				const ok = async () => new Response(JSON.stringify({ status: 200, reason: 'OK', result: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
				a.addRoute('GET', '/reports/manage', requireAuthMw, withWorkspaceMw(store), requireManager(store, {}), requirePermission('read', 'reports'), ok);
				a.addRoute('GET', '/reports', requireAuthMw, withWorkspaceMw(store), requirePermission('read', 'reports'), ok);
			},
		} as never);
	await app.boot();
	const s = app.listen(0, { quiet: true }) as unknown as typeof server & { address(): { port: number }; listening: boolean; once(e: string, f: () => void): void };
	await new Promise<void>((r) => (s.listening ? r() : s.once('listening', r)));
	server = s;
	base = `http://127.0.0.1:${s.address().port}`;
});

after(async () => {
	if (!PG_URL) return;
	server?.closeAllConnections?.();
	await new Promise<void>((r) => server?.close(() => r()));
	await inner.end?.();
});

interface Person { id: string; email: string; token: string }
let n = 0;

async function call(token: string | null, method: string, path: string, body?: unknown, workspaceId?: string) {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {}),
			...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
		},
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string; result?: Record<string, unknown> };
	return { status: res.status, reason: json.reason, result: (json.result ?? {}) as Record<string, any> };
}

async function person(first: string): Promise<Person> {
	const email = `rt${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: first, lastName: 'Tester' });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { id: r.result['user'].id as string, email, token: r.result['tokens'].access as string };
}

/** The statements one request costs. */
async function measure(token: string, path: string, ws: string): Promise<{ status: number; reason?: string; queries: string[] }> {
	seen.length = 0;
	counting = true;
	try {
		const r = await call(token, 'GET', path, undefined, ws);
		return { status: r.status, ...(r.reason ? { reason: r.reason } : {}), queries: [...seen] };
	} finally {
		counting = false;
	}
}

test('one workspace-scoped request costs a bounded number of queries', { skip }, async () => {
	const owner = await person('Olivia');
	const created = await call(owner.token, 'POST', '/workspaces', { name: `Roundtrips ${n}-${Date.now()}` });
	assert.equal(created.status, 201, JSON.stringify(created));
	const ws = created.result['workspace'].id as string;

	const member = await person('Marco');
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email: member.email }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const m = [...emitted].reverse().find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	const token = (m!.payload['data'] as Record<string, string>)['token'];
	assert.equal((await call(member.token, 'POST', '/workspaces/invitations/accept', { token })).status, 200);

	// Warm once each (the counter backend's opportunistic purge runs on a
	// process's first increment), then count.
	await call(owner.token, 'GET', '/reports/manage', undefined, ws);
	await call(member.token, 'GET', '/reports', undefined, ws);

	const o = await measure(owner.token, '/reports/manage', ws);
	assert.equal(o.status, 200, JSON.stringify(o));
	const g = await measure(member.token, '/reports', ws);
	assert.equal(g.status, 200, JSON.stringify(g));

	// eslint-disable-next-line no-console
	console.log(
		`[roundtrips] owner manager+permission route: ${BEFORE.owner} → ${o.queries.length} queries\n` +
			o.queries.map((q) => `    ${q}`).join('\n') +
			`\n[roundtrips] member permission route: ${BEFORE.member} → ${g.queries.length} queries\n` +
			g.queries.map((q) => `    ${q}`).join('\n'),
	);
	assert.ok(o.queries.length <= CEILING.owner, `owner request made ${o.queries.length} queries (ceiling ${CEILING.owner})`);
	assert.ok(g.queries.length <= CEILING.member, `member request made ${g.queries.length} queries (ceiling ${CEILING.member})`);

	// The refusals the shortcuts must not change: a plain member is no manager.
	const refused = await measure(member.token, '/reports/manage', ws);
	assert.equal(refused.status, 403);
	assert.equal(refused.reason, 'MANAGER_REQUIRED');
	// A member holding the system ADMIN role (not the owner) is a manager —
	// decided from the roles withWorkspace already read, at the same cost.
	const promoted = await call(owner.token, 'POST', `/workspaces/members/${member.id}/manager`, undefined, ws);
	assert.ok(promoted.status < 300, JSON.stringify(promoted));
	const asAdmin = await measure(member.token, '/reports/manage', ws);
	assert.equal(asAdmin.status, 200, JSON.stringify(asAdmin));
	assert.ok(asAdmin.queries.length <= CEILING.owner, `admin request made ${asAdmin.queries.length} queries`);

	// …and an outsider is not a member: billing's own check answers first.
	const outsider = await person('Otto');
	const out = await call(outsider.token, 'GET', '/reports', undefined, ws);
	assert.equal(out.status, 403);
	assert.equal(out.reason, 'FORBIDDEN');
});
