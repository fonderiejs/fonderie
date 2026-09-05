/**
 * Asserts this backend speaks every endpoint the mobile starter calls.
 *
 * The starter documents its contract in docs/OPERATIONS_PLAYBOOK.md and checks
 * that against its own source. This is the other half of the handshake: proof
 * that the backend answers on all of them.
 *
 * NO DATABASE REQUIRED. The starter-facing router is mounted on a bare Hono app
 * with a stub store, so this runs in CI with nothing else installed. An
 * anonymous request is enough to tell a route that exists (401) from one that
 * does not (404), and authentication is rejected before the store is ever
 * touched.
 *
 * For a full run against real data, see the "Try it" section of README.md —
 * that needs Postgres.
 */

import { strict as assert } from 'node:assert';
import { test }             from 'node:test';
import { readFileSync }        from 'node:fs';
import { Hono }                from 'hono';
import type { IStoreAdapter }  from '@fonderie/store';

import { buildStarterRouter } from './starter.routes.js';

// Never reached: requireAuth rejects before any handler runs. If a change ever
// lets a handler run unauthenticated, this throws and the test fails loudly
// rather than passing silently.
const stubStore = {
	query: async () => {
		throw new Error('the store was reached without authentication');
	},
} as unknown as IStoreAdapter;

// Stands in for Fonderie. The real one needs a database; these tests only care
// about routing and rejection, neither of which reaches it.
const stubFonderie = {
	handle: async () => new Response('{}', { status: 200 }),
};

const app = new Hono();

// What bridge() does in production, minus the database: give the Fonderie
// middleware a context to read. `user: null` is an anonymous caller, which is
// what every test here sends.
app.use('*', async (c, next) => {
	c.set('_fonderie', { request: c.req.raw, tenant: null, user: null, workspace: null, meta: {} });
	await next();
});

app.route('/v1', buildStarterRouter(stubFonderie, stubStore, '/v1'));

/** Every path the starter's data layer and services call. */
const CONTRACT: [string, string][] = [
	['GET',    '/v1/projects'],
	['GET',    '/v1/projects/00000000-0000-0000-0000-000000000000'],
	['POST',   '/v1/projects'],
	['PATCH',  '/v1/projects/00000000-0000-0000-0000-000000000000'],
	['DELETE', '/v1/projects/00000000-0000-0000-0000-000000000000'],
	['GET',    '/v1/members'],
	['POST',   '/v1/members/invitations'],
	['PATCH',  '/v1/members/00000000-0000-0000-0000-000000000000'],
	['DELETE', '/v1/members/00000000-0000-0000-0000-000000000000'],
	['GET',    '/v1/organization'],
	['PATCH',  '/v1/organization'],
	['GET',    '/v1/billing/subscription'],
	['GET',    '/v1/billing/plans'],
	['GET',    '/v1/activity'],
	['POST',   '/v1/devices'],
];

test('every endpoint the starter calls is routed', async () => {
	const missing: string[] = [];

	for (const [method, path] of CONTRACT) {
		const response = await app.request(path, { method });
		if (response.status === 404) missing.push(`${method} ${path}`);
	}

	assert.deepEqual(missing, [], `not routed:\n  ${missing.join('\n  ')}`);
});

test('every endpoint rejects an anonymous caller', async () => {
	const open: string[] = [];

	for (const [method, path] of CONTRACT) {
		const response = await app.request(path, { method });
		// 401/403 is the correct answer. A 500 would mean a handler ran and hit
		// the stub store, i.e. the route is not actually protected.
		if (response.status !== 401 && response.status !== 403) {
			open.push(`${method} ${path} → ${response.status}`);
		}
	}

	assert.deepEqual(open, [], `not protected:\n  ${open.join('\n  ')}`);
});

test('an unknown path under the same prefix still 404s', async () => {
	// Guards against a catch-all that would make the tests above vacuous.
	const response = await app.request('/v1/definitely-not-a-route');
	assert.equal(response.status, 404);
});

test('internal calls go to Fonderie directly, never back through the router', () => {
	// Several paths sit on both sides of this file — /billing/subscription is
	// both served here and called from here. Routing an internal call back
	// through the app would re-enter this handler and recurse until the stack
	// overflows, on the first request to the billing screen.
	const source = readFileSync(new URL('./starter.routes.ts', import.meta.url), 'utf8');

	assert.match(
		source,
		/fonderie\.handle\(/,
		'internal() must call fonderie.handle()',
	);
	assert.doesNotMatch(
		source,
		/app\.request\(/,
		'internal() must not route back through the Hono app — that recurses',
	);
});
