import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { FonderieApp, defineConfig } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';
import { getMigrationsPath } from '../migrations';

// The business profile on a REAL Postgres, over HTTP: what a Canadian or US
// business needs on its quotes and invoices (legal name, tax registrations,
// address, languages), normalized by the country rules in @fonderie/core/region
// — and refused, with the field named, when it is wrong.
//
//   WORKSPACES_PG_URL=postgres://... npm test -w @fonderie/workspaces

const PG_URL = process.env['WORKSPACES_PG_URL'];
const skip = PG_URL ? false : 'set WORKSPACES_PG_URL to run';
const DOMAIN = 'profile.acme.example';

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

async function owner(): Promise<{ token: string; ws: string }> {
	const email = `o${++n}-${Date.now()}@${DOMAIN}`;
	const r = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: 'Olivia', lastName: 'Tester' });
	const token = r.result['tokens'].access as string;
	const w = await call(token, 'POST', '/workspaces', { name: `Biz ${n}-${Date.now()}` });
	assert.equal(w.status, 201, JSON.stringify(w));
	return { token, ws: w.result['workspace'].id as string };
}

test('a bilingual Quebec business: address, GST/HST + QST and languages are normalized and read back', { skip }, async () => {
	const { token, ws } = await owner();
	const r = await call(token, 'PUT', '/workspaces', {
		legalName: 'Plomberie Acme Inc.',
		email: 'bureau@acme.example',
		website: 'https://acme.example',
		businessType: 'INC',
		address: { line1: '123 rue Saint-Denis', city: 'Montréal', state: 'Québec', zip: 'h2x1y4', country: 'Canada' },
		taxRegistrations: [
			{ country: 'CA', type: 'GST_HST', number: '123 456 789 RT 0001', label: 'TPS/TVH' },
			{ country: 'CA', type: 'QST', number: '1234567890TQ0001', label: 'TVQ' },
		],
		languages: ['fr-ca', 'en-CA', 'fr-CA', 'zh-hant'],
	}, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	const back = (await call(token, 'GET', '/workspaces/current', undefined, ws)).result['workspace'];
	assert.deepEqual(back.address, { line1: '123 rue Saint-Denis', line2: '', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA', accessCode: '' });
	assert.deepEqual(back.taxRegistrations, [
		{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', region: '', label: 'TPS/TVH', rate: null },
		{ country: 'CA', type: 'QST', number: '1234567890TQ0001', region: 'CA-QC', label: 'TVQ', rate: null },
	]);
	assert.deepEqual(back.languages, ['fr-CA', 'en-CA', 'zh-Hant']);
	assert.equal(back.legalName, 'Plomberie Acme Inc.');
});

test('a US business: EIN, a state permit, ZIP+4', { skip }, async () => {
	const { token, ws } = await owner();
	const r = await call(token, 'PUT', '/workspaces', {
		address: { line1: '1 Main St', city: 'Albany', state: 'new york', zip: '12207-1234', country: 'USA' },
		taxRegistrations: [
			{ country: 'US', type: 'EIN', number: '123456789' },
			{ country: 'US', type: 'STATE_SALES_TAX', number: '12-345678', region: 'US-NY' },
		],
		languages: ['en-US', 'es-US'],
	}, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	const back = r.result['workspace'];
	assert.equal(back.address.state, 'NY');
	assert.equal(back.address.country, 'US');
	assert.deepEqual(back.taxRegistrations.map((t: { number: string }) => t.number), ['12-3456789', '12-345678']);
});

test('wrong details are refused with the field named, and nothing is saved', { skip }, async () => {
	const { token, ws } = await owner();
	const cases: Array<[Record<string, unknown>, string]> = [
		[{ address: { country: 'CA', state: 'ON', zip: '12345' } }, 'zip'],
		[{ address: { country: 'US', state: 'Quebec' } }, 'state'],
		[{ taxRegistrations: [{ country: 'CA', type: 'GST_HST', number: '123456789' }] }, 'number'],
		[{ taxRegistrations: [{ country: 'CA', type: 'EIN', number: '123456789' }] }, 'number'],
		[{ languages: ['not a language'] }, 'languages'],
		[{ businessType: 'MEGACORP' }, 'businessType'],
		[{ website: 'javascript:alert(1)' }, 'website'],
	];
	for (const [body, field] of cases) {
		const r = await call(token, 'PUT', '/workspaces', body, ws);
		assert.equal(r.status, 422, `${JSON.stringify(body)} → ${JSON.stringify(r)}`);
		assert.match(r.explanation, new RegExp(`(^|\\.)${field}(\\.\\d+)*(\\.\\w+)?:`), `names ${field}: ${JSON.stringify(r)}`);
	}
	const back = (await call(token, 'GET', '/workspaces/current', undefined, ws)).result['workspace'];
	assert.deepEqual(back.taxRegistrations, []);
});

test('settings: language tag, currency and time zone are checked', { skip }, async () => {
	const { token, ws } = await owner();
	const ok = await call(token, 'PUT', '/workspaces/settings', { locale: 'fr-ca', currency: 'cad', timezone: 'America/Toronto' }, ws);
	assert.equal(ok.status, 200, JSON.stringify(ok));
	assert.equal(ok.result['settings'].locale, 'fr-CA');
	assert.equal(ok.result['settings'].currency, 'CAD');
	for (const bad of [{ currency: 'XYZ' }, { timezone: 'Mars/Olympus' }, { locale: '!!' }]) {
		assert.equal((await call(token, 'PUT', '/workspaces/settings', bad, ws)).status, 422, JSON.stringify(bad));
	}
});

test('two businesses with the same name both get a workspace, each with its own slug', { skip }, async () => {
	const slugs: string[] = [];
	for (const name of ['Acme Plumbing', 'Acme Plumbing', '水管公司', '水管公司']) {
		const { token } = await owner();
		const w = await call(token, 'POST', '/workspaces', { name });
		assert.equal(w.status, 201, `${name}: ${JSON.stringify(w)}`);
		assert.equal(w.result['workspace'].name, name);
		slugs.push(w.result['workspace'].slug as string);
	}
	assert.match(slugs[0]!, /^acme-plumbing(-[0-9a-f]{6})?$/);
	assert.match(slugs[2]!, /^workspace(-[0-9a-f]{6})?$/);
	assert.equal(new Set(slugs).size, 4, slugs.join(', '));
});

test('industry, the door code and tax rates are stored and read back; a rate needs no number yet', { skip }, async () => {
	const { token, ws } = await owner();
	const r = await call(token, 'PUT', '/workspaces', {
		industry: 'Plumbing',
		address: { line1: '123 rue Saint-Denis', line2: 'Suite 4', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA', accessCode: ' 1234# ' },
		taxRegistrations: [
			{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', rate: 5 },
			// Charged before the number arrived: the type is still checked, the region still set.
			{ country: 'CA', type: 'QST', rate: 9.975 },
			{ country: 'CA', type: 'PST', region: 'BC', number: null, rate: 7 },
			{ country: 'CA', type: 'BN', number: '123456789' },
		],
	}, ws);
	assert.equal(r.status, 200, JSON.stringify(r));
	const back = (await call(token, 'GET', '/workspaces/current', undefined, ws)).result['workspace'];
	assert.equal(back.industry, 'plumbing');
	assert.equal(back.address.line2, 'Suite 4');
	assert.equal(back.address.accessCode, '1234#');
	assert.deepEqual(back.taxRegistrations, [
		{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', region: '', label: '', rate: 5 },
		{ country: 'CA', type: 'QST', number: '', region: 'CA-QC', label: '', rate: 9.975 },
		{ country: 'CA', type: 'PST', number: '', region: 'CA-BC', label: '', rate: 7 },
		{ country: 'CA', type: 'BN', number: '123456789', region: '', label: '', rate: null },
	]);

	// null clears the industry; an address without a door code reads ''.
	const cleared = await call(token, 'PUT', '/workspaces', { industry: null, address: { line1: '1 Main St', country: 'CA' } }, ws);
	assert.equal(cleared.status, 200, JSON.stringify(cleared));
	assert.equal(cleared.result['workspace'].industry, '');
	assert.equal(cleared.result['workspace'].address.accessCode, '');
});

test('wrong industry, door code or tax rate is refused with the field named, and nothing is saved', { skip }, async () => {
	const { token, ws } = await owner();
	const cases: Array<[Record<string, unknown>, RegExp]> = [
		[{ industry: 'home cleaning!' }, /^industry:/],
		[{ industry: 'x'.repeat(41) }, /^industry:/],
		[{ address: { country: 'CA', accessCode: '1'.repeat(21) } }, /^address\.accessCode:/],
		[{ taxRegistrations: [{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', rate: 101 }] }, /^taxRegistrations\.0\.rate:/],
		[{ taxRegistrations: [{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', rate: -1 }] }, /^taxRegistrations\.0\.rate:/],
		[{ taxRegistrations: [{ country: 'CA', type: 'QST', rate: 9.9751 }] }, /^taxRegistrations\.0\.rate:/],
		[{ taxRegistrations: [{ country: 'CA', type: 'QST', rate: '9.975' }] }, /^taxRegistrations\.0\.rate:/],
		// Neither number nor rate: nothing to keep.
		[{ taxRegistrations: [{ country: 'CA', type: 'GST_HST' }] }, /^taxRegistrations\.0\.number:/],
		// Rate-only still follows the country's rules.
		[{ taxRegistrations: [{ country: 'CA', type: 'EIN', rate: 5 }] }, /^taxRegistrations\.0\.type:/],
		[{ taxRegistrations: [{ country: 'CA', type: 'PST', rate: 7 }] }, /^taxRegistrations\.0\.region:/],
		// A number given with a rate is still checked.
		[{ taxRegistrations: [{ country: 'CA', type: 'GST_HST', number: '123', rate: 5 }] }, /^taxRegistrations\.0\.number:/],
	];
	for (const [body, path] of cases) {
		const r = await call(token, 'PUT', '/workspaces', body, ws);
		assert.equal(r.status, 422, `${JSON.stringify(body)} → ${JSON.stringify(r)}`);
		assert.match(r.explanation, path, JSON.stringify(r));
	}
	const back = (await call(token, 'GET', '/workspaces/current', undefined, ws)).result['workspace'];
	assert.equal(back.industry, '');
	assert.deepEqual(back.taxRegistrations, []);
});

test('settings: document prefixes are upper-cased, replace the map, and null clears them — other settings kept', { skip }, async () => {
	const { token, ws } = await owner();
	const fresh = await call(token, 'GET', '/workspaces/settings', undefined, ws);
	assert.deepEqual(fresh.result['settings'].documentPrefixes, {});

	const set = await call(token, 'PUT', '/workspaces/settings', { currency: 'CAD', documentPrefixes: { invoice: 'acme', job: ' acme-job ', estimate: '' } }, ws);
	assert.equal(set.status, 200, JSON.stringify(set));
	assert.deepEqual(set.result['settings'].documentPrefixes, { invoice: 'ACME', job: 'ACME-JOB' });

	// Another setting alone leaves the prefixes as they were.
	const other = await call(token, 'PUT', '/workspaces/settings', { timezone: 'America/Toronto' }, ws);
	assert.deepEqual(other.result['settings'].documentPrefixes, { invoice: 'ACME', job: 'ACME-JOB' });

	const replaced = await call(token, 'PUT', '/workspaces/settings', { documentPrefixes: { job: 'J' } }, ws);
	assert.deepEqual(replaced.result['settings'].documentPrefixes, { job: 'J' });

	const cleared = await call(token, 'PUT', '/workspaces/settings', { documentPrefixes: null }, ws);
	assert.equal(cleared.status, 200, JSON.stringify(cleared));
	assert.deepEqual(cleared.result['settings'].documentPrefixes, {});
	assert.equal(cleared.result['settings'].currency, 'CAD');
	assert.equal(cleared.result['settings'].timezone, 'America/Toronto');

	const tooMany = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`kind_${String.fromCharCode(97 + i)}`, 'X']));
	for (const [bad, path] of [
		[{ invoice: 'ACME_1' }, /^documentPrefixes\.invoice:/],
		[{ invoice: 'ABCDEFGHIJK' }, /^documentPrefixes\.invoice:/],
		[{ Invoice: 'ACME' }, /^documentPrefixes\.Invoice:/],
		[{ 'bad-kind': 'ACME' }, /^documentPrefixes/],
		[tooMany, /^documentPrefixes:/],
		[['ACME'], /^documentPrefixes:/],
	] as const) {
		const r = await call(token, 'PUT', '/workspaces/settings', { documentPrefixes: bad }, ws);
		assert.equal(r.status, 422, `${JSON.stringify(bad)} → ${JSON.stringify(r)}`);
		assert.match(r.explanation, path, JSON.stringify(r));
	}
	const after = await call(token, 'GET', '/workspaces/settings', undefined, ws);
	assert.deepEqual(after.result['settings'].documentPrefixes, {});
});

test('a member cannot change the industry or the document prefixes', { skip }, async () => {
	const { token, ws } = await owner();
	const email = `m${++n}-${Date.now()}@${DOMAIN}`;
	const reg = await call(null, 'POST', '/auth/register', { email, password: 'Aa1!aaaa-bbbb-cccc', firstName: 'Max', lastName: 'Member' });
	const memberToken = reg.result['tokens'].access as string;
	const inv = await call(token, 'POST', '/workspaces/invitations', { email }, ws);
	assert.ok(inv.status < 300, JSON.stringify(inv));
	const [row] = await store.query<{ token: string }>(
		`SELECT token FROM fonderie_workspace_invitations WHERE workspace_id = $1 AND email = $2 AND status = 'PENDING'`,
		[ws, email],
	);
	const acc = await call(memberToken, 'POST', '/workspaces/invitations/accept', { token: row!.token });
	assert.ok(acc.status < 300, JSON.stringify(acc));

	assert.equal((await call(memberToken, 'PUT', '/workspaces', { industry: 'moving' }, ws)).status, 403);
	assert.equal((await call(memberToken, 'PUT', '/workspaces/settings', { documentPrefixes: { job: 'X' } }, ws)).status, 403);
	// …but reads them.
	assert.equal((await call(memberToken, 'GET', '/workspaces/settings', undefined, ws)).status, 200);
});
