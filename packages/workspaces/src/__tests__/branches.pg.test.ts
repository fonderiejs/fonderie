import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A workspace's BRANCHES on a REAL Postgres, over HTTP (migration 011): every
// workspace starts with a default branch; contacts belong to a branch, with
// one primary email / phone and one head office PER BRANCH; the workspace's
// own profile columns mirror the default branch and follow a change of
// default; domains are unique; the default cannot be archived; the profile
// written through PUT /workspaces lands on the default branch.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'branches.acme.example';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, authMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new WorkspacesModule(store, { personalWorkspace: false, invitationUrl: 'https://app.acme.example/invite/{token}' }, bus as never));
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
	await store.end?.();
});

beforeEach(() => {
	emitted.length = 0;
});

// ── helpers ──────────────────────────────────────────────────────────────────

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
	const json = (await res.json().catch(() => ({}))) as { reason?: string; explanation?: string; result?: Record<string, unknown> };
	return { status: res.status, reason: json.reason, explanation: json.explanation ?? '', result: (json.result ?? {}) as Record<string, any> };
}

async function person(label: string): Promise<Person> {
	const email = `${label}${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: 'Olivia', lastName: 'Tester' });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { id: r.result['user']?.id as string, email, token: r.result['tokens'].access as string };
}

async function owner(): Promise<{ token: string; ws: string }> {
	const p = await person('o');
	const w = await call(p.token, 'POST', '/workspaces', { name: `Branches ${n}-${Date.now()}` });
	assert.equal(w.status, 201, JSON.stringify(w));
	return { token: p.token, ws: w.result['workspace'].id as string };
}

async function member(ownerToken: string, ws: string): Promise<string> {
	const p = await person('m');
	const inv = await call(ownerToken, 'POST', '/workspaces/invitations', { email: p.email }, ws);
	assert.ok(inv.status < 300, JSON.stringify(inv));
	const [row] = await store.query<{ token: string }>(
		`SELECT token FROM fonderie_workspace_invitations WHERE workspace_id = $1 AND email = $2 AND status = 'PENDING'`,
		[ws, p.email],
	);
	const acc = await call(p.token, 'POST', '/workspaces/invitations/accept', { token: row!.token });
	assert.ok(acc.status < 300, JSON.stringify(acc));
	return p.token;
}

const contacts = async (token: string, ws: string) => (await call(token, 'GET', '/workspaces/contacts', undefined, ws)).result;
const profile = async (token: string, ws: string) => (await call(token, 'GET', '/workspaces/current', undefined, ws)).result['workspace'];

const branches = async (token: string, ws: string) => (await call(token, 'GET', '/workspaces/branches', undefined, ws)).result['branches'] as Array<Record<string, any>>;

// ── the default branch ───────────────────────────────────────────────────────

test('a new workspace has one default branch, named after it; contacts without a branch land on it', { skip }, async () => {
	const { token, ws } = await owner();
	const list = await branches(token, ws);
	assert.equal(list.length, 1);
	assert.equal(list[0]!.isDefault, true);
	assert.match(list[0]!.name, /^Branches /);
	const def = list[0]!.id as string;

	const e = await call(token, 'POST', '/workspaces/emails', { email: 'bureau@acme.example' }, ws);
	assert.equal(e.status, 201, JSON.stringify(e));
	assert.equal(e.result['email'].branchId, def);
	assert.equal(e.result['email'].isPrimary, true);
	assert.equal((await profile(token, ws)).email, 'bureau@acme.example');

	// One branch's contacts, or every branch's.
	const scoped = (await call(token, 'GET', `/workspaces/contacts?branchId=${def}`, undefined, ws)).result;
	assert.equal(scoped['emails'].length, 1);
	assert.equal((await call(token, 'GET', '/workspaces/contacts?branchId=nope', undefined, ws)).status, 422);
});

test('a workspace row from before the migration gets its default branch from its profile on first read', { skip }, async () => {
	const { token, ws } = await owner();
	await store.query(`DELETE FROM fonderie_workspace_branches WHERE workspace_id = $1`, [ws]);
	await store.query(`UPDATE fonderie_workspaces SET motto = 'On time', website = 'https://acme.example', settings = '{"locale":"fr-CA"}'::jsonb WHERE id = $1`, [ws]);
	// A contact write resolves the default branch — and creates it from the profile.
	const e = await call(token, 'POST', '/workspaces/emails', { email: 'bureau@acme.example' }, ws);
	assert.equal(e.status, 201, JSON.stringify(e));
	const [def] = await branches(token, ws);
	assert.equal(def!.isDefault, true);
	assert.equal(def!.motto, 'On time');
	assert.equal(def!.website, 'https://acme.example');
	assert.equal(def!.locale, 'fr-CA');
	assert.equal(e.result['email'].branchId, def!.id);
});

// ── a second branch ──────────────────────────────────────────────────────────

test('a second branch: its own primaries; the workspace mirrors the DEFAULT branch, and follows a change of default', { skip }, async () => {
	const { token, ws } = await owner();
	const [def] = await branches(token, ws);
	await call(token, 'POST', '/workspaces/emails', { email: 'montreal@acme.example' }, ws);
	await call(token, 'POST', '/workspaces/phones', { phone: '+15145550100' }, ws);
	await call(token, 'POST', '/workspaces/locations', { name: 'Montréal', address: { line1: '1 rue A', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA' } }, ws);

	const host = `quebec-${Date.now()}.example`;
	const made = await call(token, 'POST', '/workspaces/branches', {
		name: 'Québec Mover', domain: host.toUpperCase(), motto: 'Déménagement sans souci', locale: 'fr-CA', website: 'https://quebecmover.com',
		taxRegistrations: [{ country: 'CA', type: 'GST_HST', number: '123456789RT0001' }],
	}, ws);
	assert.equal(made.status, 201, JSON.stringify(made));
	const qc = made.result['branch'];
	assert.equal(qc.isDefault, false);
	assert.equal(qc.domain, host);
	assert.equal(qc.locale, 'fr-CA');
	assert.equal(qc.taxRegistrations[0].number, '123456789RT0001');
	assert.ok(emitted.some((e) => e.type === 'fonderie.workspace.branch.created' && e.payload['branchId'] === qc.id));

	// Its first email is ITS primary — the default branch keeps its own.
	const e = await call(token, 'POST', '/workspaces/emails', { branchId: qc.id, email: 'quebec@acme.example' }, ws);
	assert.equal(e.status, 201, JSON.stringify(e));
	assert.equal(e.result['email'].isPrimary, true);
	const all = (await contacts(token, ws)).emails as Array<{ email: string; isPrimary: boolean; branchId: string }>;
	assert.equal(all.filter((x) => x.isPrimary).length, 2);
	// The same address is allowed on another branch; twice on one is not.
	assert.equal((await call(token, 'POST', '/workspaces/emails', { branchId: qc.id, email: 'montreal@acme.example' }, ws)).status, 201);
	assert.equal((await call(token, 'POST', '/workspaces/emails', { branchId: qc.id, email: 'quebec@acme.example' }, ws)).status, 409);
	// The workspace still shows the default branch.
	assert.equal((await profile(token, ws)).email, 'montreal@acme.example');
	assert.equal((await profile(token, ws)).phone, '+15145550100');

	// Make Québec the default: the workspace's identity and contacts follow.
	const sw = await call(token, 'POST', `/workspaces/branches/${qc.id}/default`, undefined, ws);
	assert.equal(sw.status, 200, JSON.stringify(sw));
	assert.equal(sw.result['branch'].isDefault, true);
	const p = await profile(token, ws);
	assert.equal(p.email, 'quebec@acme.example');
	assert.equal(p.phone, '');
	assert.equal(p.motto, 'Déménagement sans souci');
	assert.equal(p.website, 'https://quebecmover.com');
	assert.equal(p.taxRegistrations[0].number, '123456789RT0001');
	assert.deepEqual(p.address, { line1: '', line2: '', city: '', state: '', zip: '', country: '', accessCode: '' });
	assert.equal((await branches(token, ws)).find((b) => b.id === def!.id)!.isDefault, false);
	// The old default cannot be un-flagged by hand, only replaced.
	assert.equal((await call(token, 'PATCH', `/workspaces/branches/${qc.id}`, { isDefault: false }, ws)).reason, 'DEFAULT_REQUIRED');
});

test('domains: lower-cased, one live branch per host, a host name only', { skip }, async () => {
	const a = await owner();
	const b = await owner();
	const host = `move-${Date.now()}.example`;
	assert.equal((await call(a.token, 'POST', '/workspaces/branches', { name: 'A', domain: host.toUpperCase() }, a.ws)).status, 201);
	// Another business cannot claim it either: a funnel's host names one branch.
	const dup = await call(b.token, 'POST', '/workspaces/branches', { name: 'B', domain: host }, b.ws);
	assert.equal(dup.status, 409, JSON.stringify(dup));
	assert.equal(dup.reason, 'DUPLICATE_DOMAIN');
	for (const bad of ['https://quebecmover.com', 'quebecmover.com/fr', 'not a host', '-bad.example']) {
		const r = await call(a.token, 'POST', '/workspaces/branches', { name: 'X', domain: bad }, a.ws);
		assert.equal(r.status, 422, `${bad} → ${JSON.stringify(r)}`);
	}
	// Clearing it frees it.
	const [, mine] = await branches(a.token, a.ws);
	assert.equal((await call(a.token, 'PATCH', `/workspaces/branches/${mine!.id}`, { domain: null }, a.ws)).status, 200);
	assert.equal((await call(b.token, 'POST', '/workspaces/branches', { name: 'B', domain: host }, b.ws)).status, 201);
});

test('archive: never the default; an archived branch takes no contact; restore brings it back', { skip }, async () => {
	const { token, ws } = await owner();
	const [def] = await branches(token, ws);
	assert.equal((await call(token, 'POST', `/workspaces/branches/${def!.id}/archive`, undefined, ws)).reason, 'DEFAULT_ARCHIVE');
	const other = (await call(token, 'POST', '/workspaces/branches', { name: 'Ottawa' }, ws)).result['branch'];
	const arch = await call(token, 'POST', `/workspaces/branches/${other.id}/archive`, undefined, ws);
	assert.equal(arch.status, 200, JSON.stringify(arch));
	assert.equal(arch.result['branch'].isArchived, true);
	assert.equal((await call(token, 'POST', '/workspaces/emails', { branchId: other.id, email: 'o@acme.example' }, ws)).reason, 'BRANCH_ARCHIVED');
	assert.equal((await call(token, 'POST', `/workspaces/branches/${other.id}/default`, undefined, ws)).reason, 'BRANCH_ARCHIVED');
	assert.equal((await call(token, 'POST', `/workspaces/branches/${other.id}/restore`, undefined, ws)).result['branch'].isArchived, false);
	assert.equal((await call(token, 'POST', '/workspaces/emails', { branchId: other.id, email: 'o@acme.example' }, ws)).status, 201);
	// A branch of another workspace is not found here.
	const stranger = await owner();
	assert.equal((await call(stranger.token, 'GET', `/workspaces/branches/${other.id}`, undefined, stranger.ws)).status, 404);
	assert.equal((await call(stranger.token, 'POST', '/workspaces/emails', { branchId: other.id, email: 's@acme.example' }, stranger.ws)).status, 404);
});

test('PUT /workspaces still works: identity and contacts written there land on the default branch', { skip }, async () => {
	const { token, ws } = await owner();
	const r = await call(token, 'PUT', '/workspaces', { motto: 'Fast & careful', website: 'https://acme.example', email: 'hello@acme.example', phone: '+15145550199' }, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	const [def] = await branches(token, ws);
	assert.equal(def!.motto, 'Fast & careful');
	assert.equal(def!.website, 'https://acme.example');
	const c = await contacts(token, ws);
	assert.deepEqual(c.emails.map((e: { email: string; branchId: string }) => [e.email, e.branchId]), [['hello@acme.example', def!.id]]);
	assert.equal(c.phones[0].branchId, def!.id);
	// And a branch edit shows on the workspace, since it is the default.
	assert.equal((await call(token, 'PATCH', `/workspaces/branches/${def!.id}`, { motto: 'Careful & fast' }, ws)).status, 200);
	assert.equal((await profile(token, ws)).motto, 'Careful & fast');
});

test('members read; only a manager writes', { skip }, async () => {
	const { token, ws } = await owner();
	const m = await member(token, ws);
	assert.equal((await call(m, 'GET', '/workspaces/branches', undefined, ws)).status, 200);
	assert.equal((await call(m, 'POST', '/workspaces/branches', { name: 'Nope' }, ws)).status, 403);
});
