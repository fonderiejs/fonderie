/**
 * Checks that every Fonderie route this backend calls actually exists.
 *
 * The modules are installed against a recording stub, so the route table comes
 * from Fonderie itself rather than from a list someone typed here. If a package
 * upgrade renames or removes a route, this fails at build time instead of as a
 * 404 the first time a user opens the team screen.
 *
 * No database.
 */

import { strict as assert } from 'node:assert';
import { test }             from 'node:test';

import { AuditModule }                   from '@fonderie/audit';
import { AuthModule }                    from '@fonderie/auth';
import { BillingModule, StripeProvider } from '@fonderie/billing';
import { Channel }                       from '@fonderie/courier';
import { WorkspacesModule }              from '@fonderie/workspaces';

const stubStore = { query: async () => [], transaction: async (fn: never) => fn } as never;
const stubBus = {
	publish: async () => {}, on: () => {}, subscribe: () => {}, start: async () => {},
} as never;

const collectRoutes = async (): Promise<Set<string>> => {
	const routes = new Set<string>();
	const recorder = {
		addRoute: (method: string, path: string) => { routes.add(`${method} ${path}`); },
		use: () => recorder,
		register: () => recorder,
		config: { basePath: '/v1' },
		bus: stubBus,
		store: stubStore,
	} as never;

	const modules = [
		new AuthModule(stubStore, {
			jwtSecret: 'x'.repeat(40), appName: 'Test',
			providers: [Channel.EMAIL], requireVerification: false,
		} as never, stubBus),
		new WorkspacesModule(stubStore, {}, stubBus),
		new AuditModule(stubStore),
		new BillingModule(stubStore, {
			provider: new StripeProvider('sk_test_x'),
			plans: [], successUrl: 'x://', cancelUrl: 'x://',
		} as never),
	];

	for (const mod of modules) {
		await (mod as { install: (app: never) => Promise<void> }).install(recorder);
	}
	return routes;
};

/** Every Fonderie route starter.routes.ts calls internally. */
const CALLED_INTERNALLY = [
	'GET /workspaces/members',
	'GET /workspaces/roles',
	'POST /workspaces/invitations',
	'POST /workspaces/members/:userId/roles',
	'DELETE /workspaces/members/:userId',
	'GET /workspaces/:id',
	'PUT /workspaces',
	'GET /plans',
	'GET /billing/subscription',
	'GET /audit',
];

/** Auth routes the mobile app's REST adapter calls directly. */
const CALLED_BY_THE_APP = [
	'POST /auth/login',
	'POST /auth/register',
	'POST /auth/refresh',
	'POST /auth/logout',
	'POST /auth/mfa/verify',
	'POST /auth/email/forgot',
	'PUT /users/password',
	'GET /users',
];

test('every Fonderie route this backend calls exists', async () => {
	const routes = await collectRoutes();
	const missing = CALLED_INTERNALLY.filter((r) => !routes.has(r));
	assert.deepEqual(missing, [], `no longer registered:\n  ${missing.join('\n  ')}`);
});

test('every auth route the mobile app calls exists', async () => {
	const routes = await collectRoutes();
	const missing = CALLED_BY_THE_APP.filter((r) => !routes.has(r));
	assert.deepEqual(missing, [], `no longer registered:\n  ${missing.join('\n  ')}`);
});

test('the recorder actually captured a route table', async () => {
	// Guards against the stubs silently failing and every check above passing
	// against an empty set.
	const routes = await collectRoutes();
	assert.ok(routes.size > 40, `only captured ${routes.size} routes — the stubs are broken`);
});
