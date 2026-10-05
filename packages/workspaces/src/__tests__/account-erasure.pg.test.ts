import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { MESSAGE_KEYS } from '../config';
import { accountEraser } from '../account-deletion';
import { createPersonalWorkspace } from '../services/workspaces';

// The account-deletion eraser (docs/ACCOUNT-DELETION-DESIGN.md, Phase 4) on a
// REAL Postgres: what goes with the person, what stays with the teams they
// were part of, and that a retry is harmless. The database is shared with the
// other suites — every assertion is scoped to rows this file created.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'erase.acme.example';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, unknown> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
	const { getMigrationsPath: permMigrations } = await import('@fonderie/permissions/migrations');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, authMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await new InternalMigrationRunner(store, permMigrations()).run();
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'e'.repeat(20) + 'r'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
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
	const json = (await res.json().catch(() => ({}))) as { reason?: string; result?: Record<string, unknown> };
	return { status: res.status, reason: json.reason, result: (json.result ?? {}) as Record<string, any> };
}

async function person(first = 'Ana'): Promise<Person> {
	const email = `e${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: first, lastName: 'Tester' });
	assert.equal(r.status, 201, JSON.stringify(r));
	return { id: r.result['user'].id as string, email, token: r.result['tokens'].access as string };
}

async function workspaceOf(owner: Person): Promise<string> {
	const r = await call(owner.token, 'POST', '/workspaces', { name: `Erase ${n}-${Date.now()}` });
	assert.equal(r.status, 201, JSON.stringify(r));
	return r.result['workspace'].id as string;
}

async function invite(owner: Person, ws: string, email: string): Promise<string> {
	emitted.length = 0;
	const inv = await call(owner.token, 'POST', '/workspaces/invitations', { email }, ws);
	assert.equal(inv.status, 201, JSON.stringify(inv));
	const m = emitted.find((e) => e.payload['type'] === MESSAGE_KEYS.workspaceInvitation);
	assert.ok(m, 'an invitation email was sent');
	return (m.payload as { data: Record<string, string> }).data['token']!;
}

async function join(owner: Person, ws: string, p?: Person): Promise<Person> {
	const member = p ?? (await person('Marco'));
	const token = await invite(owner, ws, member.email);
	const acc = await call(member.token, 'POST', '/workspaces/invitations/accept', { token });
	assert.equal(acc.status, 200, JSON.stringify(acc));
	return member;
}

/** A custom role with one saved permission, in a workspace the owner manages. */
async function roleWithPermission(owner: Person, ws: string): Promise<string> {
	const role = await call(owner.token, 'POST', '/workspaces/roles', { name: `Crew ${++n}` }, ws);
	assert.equal(role.status, 201, JSON.stringify(role));
	const id = role.result['role'].id as string;
	const set = await call(owner.token, 'POST', `/workspaces/roles/${id}/permissions`, { permissions: [{ permissionKey: 'jobs', canRead: true }] }, ws);
	assert.equal(set.status, 200, JSON.stringify(set));
	return id;
}

const count = async (sql: string, params: unknown[]) => Number((await store.query<{ c: string }>(sql, params))[0]!.c);
const workspaceExists = (id: string) => count(`SELECT COUNT(*) AS c FROM fonderie_workspaces WHERE id = $1`, [id]);
const membershipsOf = (userId: string) => count(`SELECT COUNT(*) AS c FROM fonderie_role_user_workspaces WHERE user_id = $1`, [userId]);
const erase = (p: Person) => accountEraser(store).erase({ userId: p.id, email: p.email, phone: null });

// ── tests ────────────────────────────────────────────────────────────────────

test('their personal and solo workspaces go with everything in them; the team they joined stays whole', { skip }, async () => {
	const ana = await person('Ana');
	const personal = await createPersonalWorkspace({ name: 'Ana', slug: `ana-${ana.id}`, ownerId: ana.id }, store);
	assert.ok(personal);
	const solo = await workspaceOf(ana);
	const soloRole = await roleWithPermission(ana, solo);
	await invite(ana, solo, `not-yet-${n}@${DOMAIN}`);

	const olivia = await person('Olivia');
	const team = await workspaceOf(olivia);
	const teamRole = await roleWithPermission(olivia, team);
	await join(olivia, team, ana);
	const marco = await join(olivia, team);

	const result = await erase(ana);
	assert.equal(result.kept, undefined, JSON.stringify(result));
	assert.ok(result.erased > 0);

	// Gone, with everything workspaces kept about them.
	const gone = [personal.id, solo];
	for (const ws of gone) assert.equal(await workspaceExists(ws), 0, `workspace ${ws} deleted`);
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_roles WHERE workspace_id = ANY($1::uuid[])`, [gone]), 0, 'their roles');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_permissions WHERE role_id = $1 OR workspace_id = ANY($2::uuid[])`, [soloRole, gone]), 0, 'their role permissions');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_workspace_invitations WHERE workspace_id = ANY($1::uuid[])`, [gone]), 0, 'their invitations');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_user_workspaces WHERE workspace_id = ANY($1::uuid[])`, [gone]), 0, 'their memberships');
	assert.equal(await membershipsOf(ana.id), 0, 'no membership anywhere');

	// The team they were part of: whole, minus them.
	assert.equal(await workspaceExists(team), 1);
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_user_workspaces WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])`, [team, [olivia.id, marco.id]]) >= 2, true);
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_permissions WHERE role_id = $1`, [teamRole]), 1, 'the team\'s role permissions');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_user_workspaces WHERE workspace_id = $1 AND user_id = $2`, [team, ana.id]), 0);
});

test('invitations to their address go, in any status and under a +tag alias; other addresses stay', { skip }, async () => {
	const ana = await person('Ana');
	const olivia = await person('Olivia');
	const team = await workspaceOf(olivia);
	await invite(olivia, team, ana.email);
	const [local, domain] = ana.email.split('@') as [string, string];
	const [guest] = await store.query<{ id: string }>(`SELECT id FROM fonderie_roles WHERE name = 'GUEST' AND workspace_id IS NULL`);
	const other = await workspaceOf(olivia);
	const insert = (ws: string, email: string, status: string) =>
		store.query(
			`INSERT INTO fonderie_workspace_invitations (workspace_id, email, role_id, status, expires_at) VALUES ($1, $2, $3, $4, now() + interval '1 day')`,
			[ws, email, guest!.id, status],
		);
	await insert(other, `${local.toUpperCase()}+Work@${domain.toUpperCase()}`, 'PENDING');
	await insert(team, `${local}+old@${domain}`, 'CANCELLED');
	await insert(team, `${local}-x@${domain}`, 'PENDING'); // a different person
	await insert(team, `x${local}@${domain}`, 'PENDING'); // a different person

	const result = await erase(ana);
	assert.equal(result.erased, 3, JSON.stringify(result));
	const left = (
		await store.query<{ email: string }>(`SELECT email FROM fonderie_workspace_invitations WHERE workspace_id = ANY($1::uuid[]) ORDER BY email`, [[team, other]])
	).map((r) => r.email);
	assert.deepEqual(left, [`${local}-x@${domain}`, `x${local}@${domain}`]);
});

test('a workspace they own that someone else still belongs to is kept and reported, never deleted', { skip }, async () => {
	const olivia = await person('Olivia');
	const team = await workspaceOf(olivia);
	const role = await roleWithPermission(olivia, team);
	const marco = await join(olivia, team);
	const solo = await workspaceOf(olivia);

	const result = await erase(olivia);
	assert.ok(result.kept, 'the receipt says something was left');
	assert.match(result.kept!, new RegExp(team));
	assert.doesNotMatch(result.kept!, new RegExp(solo));
	assert.equal(await workspaceExists(team), 1, 'the team is still there');
	assert.equal(await workspaceExists(solo), 0, 'the workspace only they used is not');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_permissions WHERE role_id = $1`, [role]), 1, 'the team keeps its roles');
	assert.equal(await count(`SELECT COUNT(*) AS c FROM fonderie_role_user_workspaces WHERE workspace_id = $1 AND user_id = $2`, [team, marco.id]) > 0, true, 'and its member');
	assert.equal(await membershipsOf(olivia.id), 0, 'their own membership rows still go');
});

test('members who are suspended or themselves deleted do not keep a workspace alive', { skip }, async () => {
	const olivia = await person('Olivia');
	const a = await workspaceOf(olivia);
	const suspended = await join(olivia, a);
	await store.query(`UPDATE fonderie_role_user_workspaces SET suspended = true WHERE workspace_id = $1 AND user_id = $2`, [a, suspended.id]);
	const b = await workspaceOf(olivia);
	const leaving = await join(olivia, b);
	await store.query(`UPDATE fonderie_users SET deleted_at = now() WHERE id = $1`, [leaving.id]);

	const result = await erase(olivia);
	assert.equal(result.kept, undefined, JSON.stringify(result));
	assert.equal(await workspaceExists(a), 0);
	assert.equal(await workspaceExists(b), 0);
	assert.equal(await membershipsOf(suspended.id), 0, 'the deleted workspace takes its membership rows with it');
});

test('a workspace that stays forgets who archived it', { skip }, async () => {
	const ana = await person('Ana');
	const olivia = await person('Olivia');
	const team = await workspaceOf(olivia);
	await join(olivia, team, ana);
	await store.query(`UPDATE fonderie_workspaces SET archived_at = now(), archived_by = $2 WHERE id = $1`, [team, ana.id]);

	await erase(ana);
	const [row] = await store.query<{ archivedBy: string | null; archivedAt: Date | null }>(
		`SELECT archived_by AS "archivedBy", archived_at AS "archivedAt" FROM fonderie_workspaces WHERE id = $1`,
		[team],
	);
	assert.equal(row?.archivedBy, null);
	assert.ok(row?.archivedAt, 'still archived — only the person is gone from it');
});

test('a second erase finds nothing and does not fail', { skip }, async () => {
	const ana = await person('Ana');
	await createPersonalWorkspace({ name: 'Ana', slug: `ana-${ana.id}`, ownerId: ana.id }, store);
	const solo = await workspaceOf(ana);
	await roleWithPermission(ana, solo);
	const olivia = await person('Olivia');
	const team = await workspaceOf(olivia);
	await join(olivia, team, ana);
	const theirTeam = await workspaceOf(ana);
	await join(ana, theirTeam); // someone else still belongs to it: kept both times

	const first = await erase(ana);
	assert.ok(first.erased > 0);
	assert.match(first.kept ?? '', new RegExp(theirTeam));
	assert.equal(await workspaceExists(solo), 0);
	const second = await erase(ana);
	assert.equal(second.erased, 0);
	assert.equal(second.kept, first.kept, 'the same workspace is reported, nothing new happens');
});
