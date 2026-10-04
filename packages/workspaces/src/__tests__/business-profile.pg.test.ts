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
	assert.deepEqual(back.address, { line1: '123 rue Saint-Denis', line2: '', city: 'Montréal', state: 'QC', zip: 'H2X 1Y4', country: 'CA' });
	assert.deepEqual(back.taxRegistrations, [
		{ country: 'CA', type: 'GST_HST', number: '123456789RT0001', region: '', label: 'TPS/TVH' },
		{ country: 'CA', type: 'QST', number: '1234567890TQ0001', region: 'CA-QC', label: 'TVQ' },
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
