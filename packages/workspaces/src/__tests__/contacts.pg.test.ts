import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A workspace's emails, phones and locations on a REAL Postgres, over HTTP:
// one primary email / phone and one head office, flags that move, the mirror
// onto the workspace's own email / phone / address kept in step both ways,
// limits, who may write, and the migration's backfill.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'contacts.acme.example';

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
	const w = await call(p.token, 'POST', '/workspaces', { name: `Contacts ${n}-${Date.now()}` });
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

// ── emails ───────────────────────────────────────────────────────────────────

test('emails: the first is primary, the flag moves, the workspace email mirrors it, the primary goes last', { skip }, async () => {
	const { token, ws } = await owner();
	const a = await call(token, 'POST', '/workspaces/emails', { email: 'Bureau@ACME.example', label: 'Office' }, ws);
	assert.equal(a.status, 201, JSON.stringify(a));
	assert.equal(a.result['email'].email, 'bureau@acme.example');
	assert.equal(a.result['email'].isPrimary, true);
	assert.equal((await profile(token, ws)).email, 'bureau@acme.example');

	const b = await call(token, 'POST', '/workspaces/emails', { email: 'factures@acme.example' }, ws);
	assert.equal(b.result['email'].isPrimary, false);
	assert.equal((await call(token, 'POST', '/workspaces/emails', { email: 'BUREAU@acme.example' }, ws)).status, 409);

	const moved = await call(token, 'PATCH', `/workspaces/emails/${b.result['email'].id}`, { isPrimary: true, label: 'Billing' }, ws);
	assert.equal(moved.status, 200, JSON.stringify(moved));
	const after = await contacts(token, ws);
	assert.deepEqual(after.emails.map((e: { email: string; isPrimary: boolean }) => [e.email, e.isPrimary]), [
		['factures@acme.example', true],
		['bureau@acme.example', false],
	]);
	assert.equal((await profile(token, ws)).email, 'factures@acme.example');

	// The primary cannot be un-flagged nor removed while another remains.
	assert.equal((await call(token, 'PATCH', `/workspaces/emails/${b.result['email'].id}`, { isPrimary: false }, ws)).reason, 'PRIMARY_REQUIRED');
	const refused = await call(token, 'DELETE', `/workspaces/emails/${b.result['email'].id}`, undefined, ws);
	assert.equal(refused.status, 409, JSON.stringify(refused));
	assert.equal((await call(token, 'DELETE', `/workspaces/emails/${a.result['email'].id}`, undefined, ws)).status, 200);
	// The last one can go: the workspace email is cleared with it.
	assert.equal((await call(token, 'DELETE', `/workspaces/emails/${b.result['email'].id}`, undefined, ws)).status, 200);
	assert.equal((await profile(token, ws)).email, '');
	assert.deepEqual((await contacts(token, ws)).emails, []);
	assert.ok(emitted.some((e) => e.type === 'fonderie.workspace.email.removed' && e.payload['emailId'] === b.result['email'].id));
});

test('two first emails at once: exactly one is primary', { skip }, async () => {
	const { token, ws } = await owner();
	const rs = await Promise.all(['one@acme.example', 'two@acme.example', 'three@acme.example'].map((email) => call(token, 'POST', '/workspaces/emails', { email }, ws)));
	assert.deepEqual(rs.map((r) => r.status), [201, 201, 201]);
	const list = (await contacts(token, ws)).emails as Array<{ isPrimary: boolean; email: string }>;
	assert.equal(list.filter((e) => e.isPrimary).length, 1);
	assert.equal((await profile(token, ws)).email, list.find((e) => e.isPrimary)!.email);
});

// ── phones ───────────────────────────────────────────────────────────────────

test('phones: international format, extensions, the primary mirrored onto the workspace phone', { skip }, async () => {
	const { token, ws } = await owner();
	const a = await call(token, 'POST', '/workspaces/phones', { phone: '+1 (514) 555-0100', label: 'Office' }, ws);
	assert.equal(a.status, 201, JSON.stringify(a));
	assert.equal(a.result['phone'].phone, '+15145550100');
	assert.equal(a.result['phone'].isPrimary, true);
	assert.equal((await profile(token, ws)).phone, '+15145550100');

	// The same number with an extension is another line; the same pair twice is not.
	const ext = await call(token, 'POST', '/workspaces/phones', { phone: '+15145550100', extension: '204', isPrimary: true }, ws);
	assert.equal(ext.status, 201, JSON.stringify(ext));
	assert.equal((await call(token, 'POST', '/workspaces/phones', { phone: '+15145550100', extension: '204' }, ws)).status, 409);
	assert.equal((await contacts(token, ws)).phones[0].extension, '204');

	for (const [bad, path] of [
		[{ phone: '514 555 0100' }, /^phone:/],
		[{ phone: '+0123' }, /^phone:/],
		[{ phone: '+15145550101', extension: 'x12' }, /^extension:/],
	] as const) {
		const r = await call(token, 'POST', '/workspaces/phones', bad, ws);
		assert.equal(r.status, 422, `${JSON.stringify(bad)} → ${JSON.stringify(r)}`);
		assert.match(r.explanation, path);
	}
});

// ── locations ────────────────────────────────────────────────────────────────

test('locations: the first is the head office (its address is the workspace address), the tax region follows the address', { skip }, async () => {
	const { token, ws } = await owner();
	const hq = await call(token, 'POST', '/workspaces/locations', {
		name: 'Montréal',
		address: { line1: '123 rue Saint-Denis', line2: 'Suite 4', city: 'Montréal', state: 'Québec', zip: 'h2x1y4', country: 'Canada', accessCode: '1234' },
		latitude: 45.5152,
		longitude: -73.5617,
		phone: '+15145550100',
	}, ws);
	assert.equal(hq.status, 201, JSON.stringify(hq));
	const loc = hq.result['location'];
	assert.equal(loc.isHeadOffice, true);
	assert.equal(loc.taxRegion, 'CA-QC');
	assert.equal(loc.latitude, 45.5152);
	assert.deepEqual(loc.address, { line1: '123 rue Saint-Denis', line2: 'Suite 4', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA', accessCode: '1234' });
	assert.deepEqual((await profile(token, ws)).address, loc.address);

	const to = await call(token, 'POST', '/workspaces/locations', {
		name: 'Toronto',
		address: { line1: '1 King St W', city: 'Toronto', state: 'ON', zip: 'M5H 1A1', country: 'CA' },
	}, ws);
	assert.equal(to.result['location'].isHeadOffice, false);
	assert.equal(to.result['location'].taxRegion, 'CA-ON');

	// The head office cannot be archived, nor un-flagged; another can take it.
	const archiveHq = await call(token, 'POST', `/workspaces/locations/${loc.id}/archive`, undefined, ws);
	assert.equal(archiveHq.status, 409, JSON.stringify(archiveHq));
	assert.equal(archiveHq.reason, 'HEAD_OFFICE_ARCHIVE');
	assert.equal((await call(token, 'PATCH', `/workspaces/locations/${loc.id}`, { isHeadOffice: false }, ws)).reason, 'HEAD_OFFICE_REQUIRED');

	const moved = await call(token, 'PATCH', `/workspaces/locations/${to.result['location'].id}`, { isHeadOffice: true }, ws);
	assert.equal(moved.status, 200, JSON.stringify(moved));
	assert.equal((await profile(token, ws)).address.city, 'Toronto');

	// Montréal is a branch now: it can be archived, and restored.
	const archived = await call(token, 'POST', `/workspaces/locations/${loc.id}/archive`, undefined, ws);
	assert.equal(archived.status, 200, JSON.stringify(archived));
	assert.equal(archived.result['location'].isArchived, true);
	assert.equal((await call(token, 'PATCH', `/workspaces/locations/${loc.id}`, { isHeadOffice: true }, ws)).reason, 'LOCATION_ARCHIVED');
	const listed = (await contacts(token, ws)).locations as Array<{ name: string; isArchived: boolean; isHeadOffice: boolean }>;
	assert.deepEqual(listed.map((l) => [l.name, l.isHeadOffice, l.isArchived]), [['Toronto', true, false], ['Montréal', false, true]]);
	const restored = await call(token, 'POST', `/workspaces/locations/${loc.id}/restore`, undefined, ws);
	assert.equal(restored.result['location'].isArchived, false);

	// A new address on the head office re-derives its tax region and the workspace address.
	const edited = await call(token, 'PATCH', `/workspaces/locations/${to.result['location'].id}`, {
		address: { line1: '1 Robson St', city: 'Vancouver', state: 'BC', zip: 'V6B 1A1', country: 'CA' },
	}, ws);
	assert.equal(edited.result['location'].taxRegion, 'CA-BC');
	assert.equal((await profile(token, ws)).address.city, 'Vancouver');
});

test('locations: a wrong tax region, coordinates or address is refused with the field named', { skip }, async () => {
	const { token, ws } = await owner();
	const address = { line1: '1 Main St', city: 'Albany', state: 'NY', zip: '12207', country: 'US' };
	const cases: Array<[Record<string, unknown>, RegExp]> = [
		[{ name: 'X', address, taxRegion: 'CA-ZZ' }, /^taxRegion:/],
		[{ name: 'X', address, taxRegion: 'quebec' }, /^taxRegion:/],
		[{ name: 'X', address, latitude: 91 }, /^latitude:/],
		[{ name: 'X', address, longitude: -181 }, /^longitude:/],
		[{ name: 'X', address: { ...address, zip: 'H2X 1Y4' } }, /^address\.zip:/],
		[{ name: '', address }, /^name:/],
		[{ name: 'X', address, phone: '555-0100' }, /^phone:/],
	];
	for (const [body, path] of cases) {
		const r = await call(token, 'POST', '/workspaces/locations', body, ws);
		assert.equal(r.status, 422, `${JSON.stringify(body)} → ${JSON.stringify(r)}`);
		assert.match(r.explanation, path, JSON.stringify(r));
	}
	assert.deepEqual((await contacts(token, ws)).locations, []);
	// Given explicitly, it wins over the address's.
	const ok = await call(token, 'POST', '/workspaces/locations', { name: 'NYC', address, taxRegion: 'us-nj' }, ws);
	assert.equal(ok.result['location'].taxRegion, 'US-NJ');
});

// ── the other direction ──────────────────────────────────────────────────────

test('PUT /workspaces email / phone / address updates the primary entries and the head office, creating them', { skip }, async () => {
	const { token, ws } = await owner();
	const r = await call(token, 'PUT', '/workspaces', {
		email: 'Bureau@acme.example',
		phone: '+15145550100',
		address: { line1: '123 rue Saint-Denis', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA' },
	}, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	let c = await contacts(token, ws);
	assert.deepEqual(c.emails.map((e: { email: string; isPrimary: boolean }) => [e.email, e.isPrimary]), [['bureau@acme.example', true]]);
	assert.deepEqual(c.phones.map((p: { phone: string }) => p.phone), ['+15145550100']);
	assert.equal(c.locations.length, 1);
	assert.equal(c.locations[0].name, 'Head office');
	assert.equal(c.locations[0].isHeadOffice, true);
	assert.equal(c.locations[0].taxRegion, 'CA-QC');

	// Changed: the primary entry changes (no second entry); an existing entry takes the flag.
	await call(token, 'POST', '/workspaces/emails', { email: 'factures@acme.example' }, ws);
	await call(token, 'PUT', '/workspaces', { email: 'factures@acme.example', phone: '+15145550199', address: { line1: '1 King St W', city: 'Toronto', state: 'ON', zip: 'M5H 1A1', country: 'CA' } }, ws);
	c = await contacts(token, ws);
	assert.deepEqual(c.emails.map((e: { email: string; isPrimary: boolean }) => [e.email, e.isPrimary]), [['factures@acme.example', true], ['bureau@acme.example', false]]);
	assert.deepEqual(c.phones.map((p: { phone: string }) => p.phone), ['+15145550199']);
	assert.equal(c.locations.length, 1);
	assert.equal(c.locations[0].taxRegion, 'CA-ON');

	// A phone not in international format stays on the workspace, as typed; the list is left alone.
	const legacy = await call(token, 'PUT', '/workspaces', { phone: '514 555 0100' }, ws);
	assert.equal(legacy.result['workspace'].phone, '514 555 0100');
	assert.deepEqual((await contacts(token, ws)).phones.map((p: { phone: string }) => p.phone), ['+15145550199']);

	// null removes the primary; the next one takes its place (and the mirror).
	const cleared = await call(token, 'PUT', '/workspaces', { email: null }, ws);
	assert.equal(cleared.result['workspace'].email, 'bureau@acme.example');
	assert.deepEqual((await contacts(token, ws)).emails.map((e: { email: string }) => e.email), ['bureau@acme.example']);
});

// ── limits, who, where ───────────────────────────────────────────────────────

test('limits: 10 emails, 10 phones', { skip }, async () => {
	const { token, ws } = await owner();
	for (let i = 0; i < 10; i++) {
		assert.equal((await call(token, 'POST', '/workspaces/emails', { email: `e${i}@acme.example` }, ws)).status, 201);
		assert.equal((await call(token, 'POST', '/workspaces/phones', { phone: `+1514555010${i}` }, ws)).status, 201);
	}
	const e = await call(token, 'POST', '/workspaces/emails', { email: 'e10@acme.example' }, ws);
	assert.equal(e.status, 422, JSON.stringify(e));
	assert.equal(e.reason, 'LIMIT_REACHED');
	assert.equal((await call(token, 'POST', '/workspaces/phones', { phone: '+15145550110' }, ws)).reason, 'LIMIT_REACHED');
});

test('limits: 50 locations', { skip }, async () => {
	const { token, ws } = await owner();
	// 50 seeded directly — the limit is under test here, not the route.
	await store.query(
		`INSERT INTO fonderie_workspace_locations (workspace_id, name, address, position)
		 SELECT $1, 'Branch ' || g, '{"country":"CA"}'::jsonb, g FROM generate_series(1, 50) g`,
		[ws],
	);
	const r = await call(token, 'POST', '/workspaces/locations', { name: 'One more', address: { country: 'CA' } }, ws);
	assert.equal(r.status, 422, JSON.stringify(r));
	assert.equal(r.reason, 'LIMIT_REACHED');
});

test('a member reads the contacts but cannot change them; another workspace’s entries are not found', { skip }, async () => {
	const a = await owner();
	const b = await owner();
	const memberToken = await member(a.token, a.ws);
	const mine = await call(a.token, 'POST', '/workspaces/emails', { email: 'bureau@acme.example' }, a.ws);
	const loc = await call(a.token, 'POST', '/workspaces/locations', { name: 'HQ', address: { country: 'CA', state: 'QC' } }, a.ws);
	const theirs = await call(b.token, 'POST', '/workspaces/emails', { email: 'office@acme.example' }, b.ws);

	const read = await call(memberToken, 'GET', '/workspaces/contacts', undefined, a.ws);
	assert.equal(read.status, 200);
	assert.equal(read.result['emails'].length, 1);
	for (const [method, path, body] of [
		['POST', '/workspaces/emails', { email: 'x@acme.example' }],
		['PATCH', `/workspaces/emails/${mine.result['email'].id}`, { label: 'x' }],
		['DELETE', `/workspaces/emails/${mine.result['email'].id}`, undefined],
		['POST', '/workspaces/phones', { phone: '+15145550100' }],
		['POST', '/workspaces/locations', { name: 'X', address: { country: 'CA' } }],
		['POST', `/workspaces/locations/${loc.result['location'].id}/archive`, undefined],
	] as const) {
		assert.equal((await call(memberToken, method, path, body, a.ws)).status, 403, `${method} ${path}`);
	}

	// B's email, addressed through A: not found — and B's row is untouched.
	assert.equal((await call(a.token, 'PATCH', `/workspaces/emails/${theirs.result['email'].id}`, { label: 'x' }, a.ws)).status, 404);
	assert.equal((await call(a.token, 'DELETE', `/workspaces/emails/${theirs.result['email'].id}`, undefined, a.ws)).status, 404);
	assert.equal((await call(a.token, 'POST', `/workspaces/locations/not-an-id/archive`, undefined, a.ws)).status, 404);
	// A's owner is no member of B: withWorkspace refuses (403), as on every workspace route.
	assert.equal((await call(a.token, 'GET', '/workspaces/contacts', undefined, b.ws)).status, 403);
	assert.equal((await contacts(b.token, b.ws)).emails.length, 1);
});

// ── the migration's backfill ─────────────────────────────────────────────────

test('backfill: a workspace from before migration 010 gets its email, phone and address as entries', { skip }, async () => {
	const { ws } = await owner();
	const sql = readFileSync(join(getMigrationsPath(), '010_workspace_contacts.sql'), 'utf8');
	const backfill = sql.slice(sql.indexOf('-- Backfill'));
	// Inside a transaction that is rolled back: the backfill runs over the whole
	// table, and this suite shares its database — nobody else's rows may change.
	const rolledBack = new Error('rollback');
	let seen: { emails: unknown[]; phones: unknown[]; locations: Array<Record<string, unknown>> } | null = null;
	await store
		.transaction(async (tx) => {
			await tx.query(`DELETE FROM fonderie_workspace_emails WHERE workspace_id = $1`, [ws]);
			await tx.query(
				`UPDATE fonderie_workspaces SET email = 'Bureau@acme.example', phone = '+15145550100',
				        address = '{"line1":"123 rue Saint-Denis","city":"Montréal","state":"qc","country":"CA"}'::jsonb
				 WHERE id = $1`,
				[ws],
			);
			await tx.query(backfill);
			seen = {
				emails: await tx.query(`SELECT email, is_primary FROM fonderie_workspace_emails WHERE workspace_id = $1`, [ws]),
				phones: await tx.query(`SELECT phone, is_primary FROM fonderie_workspace_phones WHERE workspace_id = $1`, [ws]),
				locations: await tx.query(`SELECT name, tax_region, is_head_office, address->>'city' AS city FROM fonderie_workspace_locations WHERE workspace_id = $1`, [ws]),
			};
			throw rolledBack;
		})
		.catch((err) => {
			if (err !== rolledBack) throw err;
		});
	assert.deepEqual(seen!.emails, [{ email: 'bureau@acme.example', is_primary: true }]);
	assert.deepEqual(seen!.phones, [{ phone: '+15145550100', is_primary: true }]);
	assert.deepEqual(seen!.locations, [{ name: 'Head office', tax_region: 'CA-QC', is_head_office: true, city: 'Montréal' }]);
	// Nothing stayed.
	assert.deepEqual(await store.query(`SELECT 1 FROM fonderie_workspace_phones WHERE workspace_id = $1`, [ws]), []);
});

test('backfill: an address stored before normalization (a state name, not a code) does not fail the migration', { skip }, async () => {
	const { ws } = await owner();
	const sql = readFileSync(join(getMigrationsPath(), '010_workspace_contacts.sql'), 'utf8');
	const backfill = sql.slice(sql.indexOf('-- Backfill'));
	const rolledBack = new Error('rollback');
	let rows: Array<Record<string, unknown>> = [];
	await store
		.transaction(async (tx) => {
			await tx.query(`UPDATE fonderie_workspaces SET address = '{"city":"Montréal","state":"Québec","country":"CA"}'::jsonb WHERE id = $1`, [ws]);
			await tx.query(backfill);
			rows = await tx.query(`SELECT tax_region, is_head_office FROM fonderie_workspace_locations WHERE workspace_id = $1`, [ws]);
			throw rolledBack;
		})
		.catch((err) => {
			if (err !== rolledBack) throw err;
		});
	assert.deepEqual(rows, [{ tax_region: null, is_head_office: true }]);
});
