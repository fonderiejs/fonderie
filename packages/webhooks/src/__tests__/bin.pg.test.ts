import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WebhooksModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { EndpointModel, emptyEndpointBin } from '../models/endpoint.model';

// The undo bin for webhook endpoints (docs/INSIDER-THREAT-DESIGN.md, Phase 3)
// on a REAL Postgres, over HTTP: a deleted endpoint is listed in the bin (never
// with its secret), comes back with the same id, URL, events and secret, and
// only the workspace owner removes it early.
//
//   WEBHOOKS_PG_URL=postgres://... npm test -w @fonderie/webhooks
//
// CI runs every PG suite against ONE database at once: every row here belongs
// to workspaces created by this run.

const PG_URL = process.env['WEBHOOKS_PG_URL'];
const skip = PG_URL ? false : 'set WEBHOOKS_PG_URL to run';
const DOMAIN = 'bin.acme.example';

let store: IStoreAdapter & { end?: () => Promise<void> };
let base = '';
let webhooks: WebhooksModule | undefined;
let server: { close: (cb?: () => void) => void; closeAllConnections?: () => void } | undefined;
const emitted: Array<{ type: string; payload: Record<string, any> }> = [];

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { AuthModule } = await import('@fonderie/auth');
	const { getMigrationsPath: authMigrations } = await import('@fonderie/auth/migrations');
	const { WorkspacesModule } = await import('@fonderie/workspaces');
	const { getMigrationsPath: wsMigrations } = await import('@fonderie/workspaces/migrations');
	store = new PGAdapter(PG_URL) as typeof store;
	for (const m of [authMigrations(), wsMigrations(), getMigrationsPath()]) await new InternalMigrationRunner(store, m).run();
	const bus = { emit: async (type: string, payload: Record<string, any>) => void emitted.push({ type, payload }), on() {}, subscribe() {} };
	webhooks = new WebhooksModule(store, {});
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new WorkspacesModule(store, { personalWorkspace: false }, bus as never))
		.register(webhooks);
	await app.boot();
	const s = app.listen(0, { quiet: true }) as unknown as typeof server & { address(): { port: number }; listening: boolean; once(e: string, f: () => void): void };
	await new Promise<void>((r) => (s.listening ? r() : s.once('listening', r)));
	server = s;
	base = `http://127.0.0.1:${s.address().port}`;
});

after(async () => {
	if (!PG_URL) return;
	// Its retry timer would otherwise poll a closed pool and hold the process.
	webhooks?.stop();
	server?.closeAllConnections?.();
	await new Promise<void>((r) => server?.close(() => r()));
	await store.end?.();
});

let n = 0;
async function call(token: string | null, method: string, path: string, body?: unknown, ws?: string) {
	const res = await fetch(`${base}${path}`, {
		method,
		headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(ws ? { 'x-workspace-id': ws } : {}) },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string; result?: any };
	return { status: res.status, reason: json.reason, result: json.result };
}
async function person() {
	const email = `p${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc' });
	return { id: r.result.user.id as string, email, token: r.result.tokens.access as string };
}

test('a deleted endpoint waits in the bin and comes back with its id, URL, events and secret; only the owner empties it', { skip }, async () => {
	const owner = await person();
	const ws = (await call(owner.token, 'POST', '/workspaces', { name: `Hooks ${n}-${Date.now()}` })).result.workspace.id as string;
	const mgr = await person();
	assert.equal((await call(owner.token, 'POST', '/workspaces/invitations', { email: mgr.email }, ws)).status, 201);
	const invite = [...emitted].reverse().find((e) => e.payload['type'] === 'workspace-invitation')!;
	assert.equal((await call(mgr.token, 'POST', '/workspaces/invitations/accept', { token: invite.payload['data'].token })).status, 200);
	assert.equal((await call(owner.token, 'POST', `/workspaces/members/${mgr.id}/manager`, {}, ws)).status, 200);

	const model = new EndpointModel(store);
	const ep = await model.create({ workspaceId: ws, url: 'https://hooks.acme.example/in', secret: 'whsec_aaaabbbbccccddddeeeeffff00001111', events: ['customer.created'] });

	assert.equal((await call(mgr.token, 'DELETE', `/webhooks/${ep.id}`, undefined, ws)).status, 204);
	assert.equal((await call(mgr.token, 'GET', `/webhooks/${ep.id}`, undefined, ws)).status, 404, 'gone from the endpoints');
	const bin = await call(mgr.token, 'GET', '/webhooks/bin', undefined, ws);
	assert.equal(bin.status, 200, JSON.stringify(bin));
	assert.deepEqual(bin.result.endpoints.map((b: any) => [b.id, b.url, b.events, b.deletedBy]), [[ep.id, ep.url, ['customer.created'], mgr.id]]);
	assert.ok(!JSON.stringify(bin).includes('whsec_'), 'the bin never shows the secret');

	const purge = await call(mgr.token, 'DELETE', `/webhooks/bin/${ep.id}`, undefined, ws);
	assert.deepEqual([purge.status, purge.reason], [403, 'OWNER_REQUIRED'], 'a manager cannot erase the undo');

	const r = await call(mgr.token, 'POST', `/webhooks/bin/${ep.id}/restore`, undefined, ws);
	assert.deepEqual([r.status, r.reason], [200, 'WEBHOOK_RESTORED'], JSON.stringify(r));
	const back = await model.findById(ep.id, ws);
	assert.deepEqual(back, ep, 'the same row, secret included');
	assert.deepEqual((await call(mgr.token, 'GET', '/webhooks/bin', undefined, ws)).result.endpoints, []);

	// The owner empties it early; the cron empties what is past the retention.
	await call(owner.token, 'DELETE', `/webhooks/${ep.id}`, undefined, ws);
	assert.equal((await call(owner.token, 'DELETE', `/webhooks/bin/${ep.id}`, undefined, ws)).status, 204);
	assert.equal((await call(owner.token, 'POST', `/webhooks/bin/${ep.id}/restore`, undefined, ws)).status, 404);
	const old = await model.create({ workspaceId: ws, url: 'https://hooks.acme.example/old', secret: 'whsec_aaaabbbbccccddddeeeeffff00002222', events: [] });
	await model.delete(old.id, ws, owner.id);
	await store.query(`UPDATE fonderie_webhook_endpoint_bin SET deleted_at = now() - interval '31 days' WHERE id = $1`, [old.id]);
	assert.ok((await emptyEndpointBin(store)) >= 1);
	assert.equal((await store.query('SELECT 1 FROM fonderie_webhook_endpoint_bin WHERE id = $1', [old.id])).length, 0);
});

// ── Step-up (insider threat, Phase 4) ───────────────────────────────────────

test('a new endpoint — or a new URL for one — needs a fresh proof it is the person; turning one off does not', { skip }, async () => {
	const owner = await person();
	const ws = (await call(owner.token, 'POST', '/workspaces', { name: `Proof ${n}-${Date.now()}` })).result.workspace.id as string;
	const body = { url: 'https://hooks.acme.example/feed', events: [] };
	const bare = await call(owner.token, 'POST', '/webhooks', body, ws);
	assert.deepEqual([bare.status, bare.reason], [403, 'STEP_UP_REQUIRED'], 'a live copy of every event is a big move');

	const ep = await new EndpointModel(store).create({ workspaceId: ws, url: 'https://hooks.acme.example/a', secret: 'whsec_aaaabbbbccccddddeeeeffff00003333', events: [] });
	const moved = await call(owner.token, 'PATCH', `/webhooks/${ep.id}`, { url: 'https://hooks.acme.example/b' }, ws);
	assert.deepEqual([moved.status, moved.reason], [403, 'STEP_UP_REQUIRED'], 'pointing it elsewhere is the same move');
	assert.equal((await call(owner.token, 'PATCH', `/webhooks/${ep.id}`, { enabled: false }, ws)).status, 200, 'turning it off is not');

	const proof = await call(owner.token, 'POST', '/auth/step-up', { password: 'Aa1!aaaa-bbbb-cccc' });
	assert.equal(proof.status, 200, JSON.stringify(proof));
	const res = await fetch(`${base}/webhooks/${ep.id}`, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${owner.token}`, 'x-workspace-id': ws, 'x-step-up': proof.result.stepUpToken },
		body: JSON.stringify({ url: 'https://hooks.acme.example/b' }),
	});
	const json = (await res.json().catch(() => ({}))) as { reason?: string };
	assert.notEqual(json.reason, 'STEP_UP_REQUIRED', 'with the proof the guard lets it through');
});

