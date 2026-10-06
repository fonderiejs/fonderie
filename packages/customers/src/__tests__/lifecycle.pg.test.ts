import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '@fonderie/workspaces';
import { getMigrationsPath as workspacesMigrations } from '@fonderie/workspaces/migrations';

import { CustomersModule } from '../module';
import { getMigrationsPath } from '../migrations';

// Customers on a REAL Postgres, over HTTP: preferred language (defaulting to
// the business's), names shown in the order their language writes them,
// search by email and phone, archive, a delete that is all-or-nothing and
// refused while something references the customer, primaries that cannot be
// lost, North American addresses, and an unambiguous relationship shape.
//
//   CUSTOMERS_PG_URL=postgres://... npm test -w @fonderie/customers

const PG_URL = process.env['CUSTOMERS_PG_URL'];
const skip = PG_URL ? false : 'set CUSTOMERS_PG_URL to run';
const DOMAIN = 'lifecycle.acme.example';

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
	await new InternalMigrationRunner(store, workspacesMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	// An APP table that references customers — what a job or an invoice is.
	await store.query(`CREATE TABLE IF NOT EXISTS test_app_jobs (id serial PRIMARY KEY, customer_id uuid NOT NULL REFERENCES fonderie_customers(id))`);
	const { getMigrationsPath: permMigrations } = await import('@fonderie/permissions/migrations');
	await new InternalMigrationRunner(store, permMigrations()).run();
	const bus = {
		emit: async (type: string, payload: Record<string, unknown>) => void emitted.push({ type, payload }),
		on() {},
		subscribe() {},
	};
	const app = new FonderieApp(defineConfig({ db: { url: PG_URL } }))
		.register(new AuthModule(store, { jwtSecret: 'k'.repeat(20) + 'm'.repeat(20), providers: ['email'], rateLimit: false } as never, bus as never))
		.register(new WorkspacesModule(store, { personalWorkspace: false }, bus as never))
		.register(new CustomersModule(store, {}, bus as never));
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
	const json = (await res.json().catch(() => ({}))) as { reason?: string; result?: Record<string, unknown> };
	return { status: res.status, reason: json.reason, result: (json.result ?? {}) as Record<string, any> };
}

async function owner(): Promise<{ token: string; ws: string }> {
	const email = `o${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: 'Olivia', lastName: 'Tester' });
	const token = r.result['tokens'].access as string;
	const w = await call(token, 'POST', '/workspaces', { name: `Life ${n}-${Date.now()}` });
	assert.equal(w.status, 201, JSON.stringify(w));
	return { token, ws: w.result['workspace'].id as string };
}

const create = async (o: { token: string; ws: string }, body: Record<string, unknown>) => {
	const r = await call(o.token, 'POST', '/customers', body, o.ws);
	assert.equal(r.status, 201, JSON.stringify(r));
	return r.result['customer'] as Record<string, any>;
};
const list = async (o: { token: string; ws: string }, q = '') => (await call(o.token, 'GET', `/customers${q}`, undefined, o.ws)).result as { customers: Array<Record<string, any>>; total: number };

test('a customer speaks the business\'s language unless told otherwise; tags are canonical', { skip }, async () => {
	const o = await owner();
	assert.equal((await call(o.token, 'PUT', '/workspaces/settings', { locale: 'fr-CA' }, o.ws)).status, 200);
	assert.equal((await create(o, { firstName: 'Marie', lastName: 'Tremblay' })).locale, 'fr-CA');
	assert.equal((await create(o, { firstName: 'Ming', lastName: 'Wong', locale: 'zh-hant-hk' })).locale, 'zh-Hant-HK');
	assert.equal((await call(o.token, 'POST', '/customers', { firstName: 'X', locale: '!!' }, o.ws)).status, 422);
});

test('names show in the order the customer\'s language writes them', { skip }, async () => {
	const o = await owner();
	assert.equal((await create(o, { firstName: '小明', lastName: '王', locale: 'zh-Hans' })).displayName, '王小明');
	assert.equal((await create(o, { firstName: 'Marie', lastName: 'Tremblay', locale: 'fr-CA' })).displayName, 'Marie Tremblay');
	assert.equal((await create(o, { type: 'business', companyName: 'Plomberie Acme', firstName: 'Ana' })).displayName, 'Plomberie Acme');
});

test('search finds a customer by email and by phone digits, and the total matches', { skip }, async () => {
	const o = await owner();
	const c = await create(o, { firstName: 'Search', lastName: 'Me' });
	await create(o, { firstName: 'Other', lastName: 'One' });
	assert.equal((await call(o.token, 'POST', `/customers/${c.id}/emails`, { email: 'billing@client.example' }, o.ws)).status, 201);
	assert.equal((await call(o.token, 'POST', `/customers/${c.id}/phones`, { phone: '+1 (514) 555-0100' }, o.ws)).status, 201);
	for (const q of ['billing@client', '514 555', '5550100']) {
		const r = await list(o, `?search=${encodeURIComponent(q)}`);
		assert.deepEqual(r.customers.map((x) => x['id']), [c.id], q);
		assert.equal(r.total, 1, q);
	}
	assert.equal((await list(o, '?search=%25')).total, 0, 'a literal % matches nothing, not everything');
});

test('an archived customer leaves lists and pickers, can be listed on purpose, and comes back', { skip }, async () => {
	const o = await owner();
	const c = await create(o, { firstName: 'Gone', lastName: 'Quiet' });
	const a = await call(o.token, 'POST', `/customers/${c.id}/archive`, {}, o.ws);
	assert.equal(a.status, 200, JSON.stringify(a));
	assert.equal(a.result['customer'].archived.status, true);
	assert.equal((await list(o)).customers.some((x) => x['id'] === c.id), false);
	assert.deepEqual((await list(o, '?archived=true')).customers.map((x) => x['id']), [c.id]);
	assert.equal((await list(o, '?archived=all')).total, 1);
	assert.equal((await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).status, 200, 'still readable by id (documents link to it)');
	assert.equal((await call(o.token, 'POST', `/customers/${c.id}/unarchive`, {}, o.ws)).status, 200);
	assert.equal((await list(o)).customers.some((x) => x['id'] === c.id), true);
});

test('a referenced customer cannot be deleted — and the refusal loses nothing', { skip }, async () => {
	const o = await owner();
	const c = await create(o, { firstName: 'On', lastName: 'AJob' });
	await call(o.token, 'POST', `/customers/${c.id}/emails`, { email: 'keep@client.example' }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/notes`, { body: 'Gate code 1234' }, o.ws);
	await store.query('INSERT INTO test_app_jobs (customer_id) VALUES ($1)', [c.id]);

	const del = await call(o.token, 'DELETE', `/customers/${c.id}`, undefined, o.ws);
	assert.equal(del.status, 409, JSON.stringify(del));
	assert.equal(del.reason, 'CUSTOMER_IN_USE');
	const detail = (await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).result;
	assert.deepEqual(detail.emails.map((e: { email: string }) => e.email), ['keep@client.example'], 'emails survived');
	assert.equal(detail.notes.length, 1, 'notes survived');

	await store.query('DELETE FROM test_app_jobs WHERE customer_id = $1', [c.id]);
	assert.equal((await call(o.token, 'DELETE', `/customers/${c.id}`, undefined, o.ws)).status, 200);
	const [left] = await store.query<{ n: string }>('SELECT COUNT(*) AS n FROM fonderie_customer_emails WHERE customer_id = $1', [c.id]);
	assert.equal(left!.n, '0');
});

test('making a wrong id primary is refused and the current primary stays', { skip }, async () => {
	const o = await owner();
	const c = await create(o, { firstName: 'Prime', lastName: 'Time' });
	const e = (await call(o.token, 'POST', `/customers/${c.id}/emails`, { email: 'main@client.example', isPrimary: true }, o.ws)).result;
	void e;
	const other = await create(o, { firstName: 'Other', lastName: 'Person' });
	const foreign = (await call(o.token, 'POST', `/customers/${other.id}/emails`, { email: 'theirs@client.example' }, o.ws)).result['email'];
	const r = await call(o.token, 'PUT', `/customers/${c.id}/emails/${foreign.id}/primary`, undefined, o.ws);
	assert.equal(r.status, 404, JSON.stringify(r));
	const emails = (await call(o.token, 'GET', `/customers/${c.id}/emails`, undefined, o.ws)).result['emails'] as Array<{ email: string; isPrimary: boolean }>;
	assert.deepEqual(emails.filter((x) => x.isPrimary).map((x) => x.email), ['main@client.example']);
});

test('a Canadian address on a customer is normalized; a wrong postal code is refused', { skip }, async () => {
	const o = await owner();
	const c = await create(o, { firstName: 'Addr', lastName: 'Ess' });
	const ok = await call(o.token, 'POST', `/customers/${c.id}/addresses`, { line1: '1 rue Principale', countryIso: 'Canada', subdivision1Iso: 'Québec', zipPostalCode: 'g1r4p3' }, o.ws);
	assert.equal(ok.status, 201, JSON.stringify(ok));
	const a = ok.result['address'].address;
	assert.deepEqual([a.countryIso, a.subdivision1Iso, a.zipPostalCode], ['CA', 'QC', 'G1R 4P3']);
	assert.equal((await call(o.token, 'POST', `/customers/${c.id}/addresses`, { countryIso: 'CA', zipPostalCode: '90210' }, o.ws)).status, 422);
});

test('a relationship names the related customer unambiguously', { skip }, async () => {
	const o = await owner();
	const parent = await create(o, { firstName: 'Parent', lastName: 'One' });
	const child = await create(o, { firstName: 'Child', lastName: 'Two' });
	assert.equal((await call(o.token, 'POST', `/customers/${parent.id}/relationships`, { relatedId: child.id, relationship: 'spouse' }, o.ws)).status, 201);
	const rel = (await call(o.token, 'GET', `/customers/${parent.id}`, undefined, o.ws)).result.relationships[0];
	assert.equal(rel.relatedId, child.id);
	assert.notEqual(rel.relationshipId, child.id);
	assert.equal(rel.firstName, 'Child');
});

// ── The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3) ───────────────────

test('a deleted customer waits in the bin and comes back whole — same id, emails, phones, notes, tags, address, relationship', { skip }, async () => {
	const o = await owner();
	const friend = await create(o, { firstName: 'Friend', lastName: 'Kept' });
	const c = await create(o, { firstName: 'Gone', lastName: 'ForNow' });
	await call(o.token, 'POST', `/customers/${c.id}/emails`, { email: `gone-${n}@client.example`, isPrimary: true }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/phones`, { phone: '+15145550123' }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/notes`, { body: 'Gate code 1234' }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/tags`, { tag: 'vip' }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/addresses`, { line1: '1 rue Principale', countryIso: 'CA', subdivision1Iso: 'QC', zipPostalCode: 'G1R 4P3' }, o.ws);
	await call(o.token, 'POST', `/customers/${c.id}/relationships`, { relatedId: friend.id, relationship: 'spouse' }, o.ws);
	const before = (await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).result;

	assert.equal((await call(o.token, 'DELETE', `/customers/${c.id}`, undefined, o.ws)).status, 200);
	assert.equal((await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).status, 404, 'gone from the customers');
	const bin = (await call(o.token, 'GET', '/customers/bin', undefined, o.ws)).result['customers'] as Array<Record<string, any>>;
	assert.deepEqual(bin.map((b) => [b.id, b.firstName]), [[c.id, 'Gone']], 'in the bin');
	assert.equal(Math.round((Date.parse(bin[0]!.purgeAt) - Date.parse(bin[0]!.deletedAt)) / 86_400_000), 30);

	const r = await call(o.token, 'POST', `/customers/bin/${c.id}/restore`, undefined, o.ws);
	assert.deepEqual([r.status, r.reason], [200, 'CUSTOMER_RESTORED'], JSON.stringify(r));
	const after = (await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).result;
	assert.deepEqual(after, before, 'everything came back exactly');
	assert.deepEqual((await call(o.token, 'GET', '/customers/bin', undefined, o.ws)).result['customers'], [], 'and left the bin');
	assert.equal((await call(o.token, 'POST', `/customers/bin/${c.id}/restore`, undefined, o.ws)).status, 404, 'restored once');
});

test('a refused delete leaves nothing in the bin; a restore whose reference code was taken changes nothing', { skip }, async () => {
	const o = await owner();
	const busy = await create(o, { firstName: 'On', lastName: 'AJob' });
	await store.query('INSERT INTO test_app_jobs (customer_id) VALUES ($1)', [busy.id]);
	assert.equal((await call(o.token, 'DELETE', `/customers/${busy.id}`, undefined, o.ws)).status, 409);
	assert.deepEqual((await call(o.token, 'GET', '/customers/bin', undefined, o.ws)).result['customers'], []);
	await store.query('DELETE FROM test_app_jobs WHERE customer_id = $1', [busy.id]);

	// The reference code is the one thing unique across a workspace's customers.
	const c = await create(o, { firstName: 'First', lastName: 'Twin' });
	await call(o.token, 'DELETE', `/customers/${c.id}`, undefined, o.ws);
	const taker = await create(o, { firstName: 'Second', lastName: 'Twin' });
	const took = await call(o.token, 'PUT', `/customers/${taker.id}`, { referenceCode: c.referenceCode }, o.ws);
	assert.equal(took.status, 200, JSON.stringify(took));
	const r = await call(o.token, 'POST', `/customers/bin/${c.id}/restore`, undefined, o.ws);
	assert.deepEqual([r.status, r.reason], [409, 'RESTORE_CONFLICT']);
	assert.equal((await call(o.token, 'GET', `/customers/${c.id}`, undefined, o.ws)).status, 404, 'nothing half-restored');
	assert.equal(((await call(o.token, 'GET', '/customers/bin', undefined, o.ws)).result['customers'] as unknown[]).length, 1, 'still in the bin');

	// The owner can empty it; after the retention the cron does.
	assert.equal((await call(o.token, 'DELETE', `/customers/bin/${c.id}`, undefined, o.ws)).status, 204);
	assert.deepEqual((await call(o.token, 'GET', '/customers/bin', undefined, o.ws)).result['customers'], []);
	const { emptyCustomerBin } = await import('../models/customer-bin');
	await call(o.token, 'DELETE', `/customers/${taker.id}`, undefined, o.ws);
	await store.query(`UPDATE fonderie_customer_bin SET deleted_at = now() - interval '31 days' WHERE id = $1`, [taker.id]);
	assert.ok((await emptyCustomerBin(store)) >= 1);
	assert.equal((await store.query('SELECT 1 FROM fonderie_customer_bin WHERE id = $1', [taker.id])).length, 0, 'past the retention: gone');
});

test('a code the caller chose that someone holds is a 409 naming it, on create and on update', { skip }, async () => {
	const o = await owner();
	const a = await create(o, { firstName: 'Code', lastName: 'Holder' });
	const dupReferral = await call(o.token, 'POST', '/customers', { firstName: 'Same', referralCode: a.referralCode }, o.ws);
	assert.deepEqual([dupReferral.status, dupReferral.reason], [409, 'DUPLICATE_REFERRAL_CODE']);
	const b = await create(o, { firstName: 'Other', lastName: 'Holder' });
	const dupReference = await call(o.token, 'PUT', `/customers/${b.id}`, { referenceCode: a.referenceCode }, o.ws);
	assert.deepEqual([dupReference.status, dupReference.reason], [409, 'DUPLICATE_REFERENCE_CODE']);
});

test('the reference-code counter steps over a code typed by hand, on create and on update', { skip }, async () => {
	const o = await owner();
	const first = await create(o, { firstName: 'Counted' });
	const n = Number(String(first.referenceCode).split('-')[1]);
	const code = (i: number) => `CLT-${String(i).padStart(4, '0')}`;
	await create(o, { firstName: 'Typed', referenceCode: code(n + 1) });
	const next = await call(o.token, 'POST', '/customers', { firstName: 'Next' }, o.ws);
	assert.equal(next.status, 201, `the counter handed out a code it never checked: ${JSON.stringify(next)}`);
	assert.equal(next.result['customer'].referenceCode, code(n + 2));

	// A customer without a code gets one on update — the same counter.
	await create(o, { firstName: 'Typed', referenceCode: code(n + 3) });
	await store.query('UPDATE fonderie_customers SET reference_code = NULL WHERE id = $1', [first.id]);
	const upd = await call(o.token, 'PUT', `/customers/${first.id}`, { firstName: 'Recoded' }, o.ws);
	assert.equal(upd.status, 200, JSON.stringify(upd));
	assert.equal(upd.result['customer'].referenceCode, code(n + 4));
});

test('two creates drawing the same referral code: both are created, with different codes', { skip }, async () => {
	const { CustomerModel } = await import('../models/customer.model');
	const { randomUUID } = await import('node:crypto');
	const model = new CustomerModel(store);
	const workspaceId = randomUUID();
	// Both pre-checks see the code free; the unique index decides at insert.
	const draws = ['RACE2345', 'RACE2345'];
	const m = model as unknown as { randomReferralCode: () => string };
	const real = m.randomReferralCode.bind(model);
	m.randomReferralCode = () => draws.shift() ?? real();
	const made = await Promise.allSettled([
		model.create({ workspaceId, firstName: 'One' }),
		model.create({ workspaceId, firstName: 'Two' }),
	]);
	assert.deepEqual(made.map((r) => r.status), ['fulfilled', 'fulfilled'], JSON.stringify(made.map((r) => r.status === 'rejected' ? String(r.reason) : 'ok')));
	const codes = made.map((r) => (r as PromiseFulfilledResult<{ referralCode: string }>).value.referralCode);
	assert.notEqual(codes[0], codes[1]);
	await store.query('DELETE FROM fonderie_customers WHERE workspace_id = $1', [workspaceId]);
});
