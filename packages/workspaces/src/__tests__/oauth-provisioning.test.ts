import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { FonderieApp, defineConfig } from '@fonderie/core';
import { EventBus, MemoryTransport } from '@fonderie/events';
import { AuthModule } from '@fonderie/auth';
import type { IStoreAdapter } from '@fonderie/store';

import { WorkspacesModule } from '../module';

/**
 * Does an OAuth sign-up actually get a personal workspace?
 *
 * Every existing test answers half of this, and neither answers it together:
 *
 *   • workspaces' own test hand-invokes the subscription with a fake bus. It
 *     proves "IF user.registered fires, we provision" — never that anything
 *     fires it.
 *   • auth's tests assert the controller emits onto a stubbed bus. They prove
 *     "we emit" — never that a subscriber is listening for that exact name.
 *
 * Both passed for months while OAuth sign-ups silently received no workspace,
 * because auth's OAuth path emitted nothing at all and no test spanned the
 * seam. The two halves are joined by a STRING (`fonderie.user.registered`),
 * duplicated in both packages precisely so neither needs a runtime dependency
 * on the other — exactly the kind of contract a mock on either side cannot
 * check.
 *
 * So this drives the real HTTP route on a real FonderieApp, with both real
 * modules registered on one real EventBus, and stubs only the database and the
 * call out to Google. If the event name drifts on either side, if the
 * controller stops emitting, or if the modules stop sharing a bus, this fails.
 */

const CLIENT_ID = 'client-123.apps.googleusercontent.com';

// Google's id_token is decoded (after aud/iss/exp/email_verified checks) rather
// than signature-verified at this point, so a hand-built payload is enough.
const ID_CLAIMS = {
	email: 'jane@example.com',
	sub: 'google-sub-1',
	aud: CLIENT_ID,
	iss: 'https://accounts.google.com',
	exp: Math.floor(Date.now() / 1000) + 3600,
	email_verified: true,
};

function fakeIdToken(payload: object): string {
	return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

const USER_ROW = {
	id: 'user-1',
	email: 'jane@example.com',
	firstName: 'Jane',
	lastName: 'Doe',
	phone: null,
	profileImageUrl: null,
	locale: 'en-US',
	timezone: 'UTC',
	isActive: true,
	lastLogin: null,
	preferences: null,
	suspended: false,
	whitelist: false,
	ipWhitelist: [],
	mfaEnabled: false,
	emailVerifiedAt: new Date(),
	provider: 'google',
	passwordHash: null,
	deletedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

/**
 * One store for both modules: auth writes the user, workspaces reads the system
 * role and writes the workspace. Routed by SQL text, recording every statement
 * so the assertions can ask what actually reached the database.
 *
 * `upsert` is the knob under test — it is what tells the controller whether
 * this sign-in created the account or merely authenticated an existing one.
 */
function makeStore(
	seen: string[],
	upsert: { id: string; inserted: boolean; previousProvider: string | null },
): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			seen.push(sql);

			// Matched first: upsertByProvider reads the pre-insert row in a CTE, so
			// its SQL also contains 'WHERE email = $1'.
			if (sql.includes('INSERT INTO fonderie_users')) return [upsert] as unknown as T[];

			if (sql.includes('fonderie_users') && sql.includes('WHERE id = $1'))
				return [USER_ROW] as unknown as T[];

			if (sql.includes('fonderie_roles')) return [{ id: 'role-admin' }] as unknown as T[];

			if (sql.includes('INSERT INTO fonderie_workspaces'))
				return [{ id: 'ws-1', name: 'Jane Doe', is_personal: true }] as unknown as T[];

			return [] as T[];
		},
		transaction: async (fn: (tx: IStoreAdapter) => unknown) => fn(store),
	} as unknown as IStoreAdapter;
	return store;
}

async function bootApp(store: IStoreAdapter) {
	// ONE bus, both modules — the composition an app actually uses. Registering
	// them on separate buses is the other way this silently breaks.
	const bus = new EventBus(new MemoryTransport());
	const app = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	app.register(
		new AuthModule(
			store,
			{
				jwtSecret: 'test-secret-value-that-is-long-enough-32',
				providers: ['google'],
				google: {
					clientId: CLIENT_ID,
					clientSecret: 'secret',
					redirectUri: 'https://app.test/auth/google/callback',
				},
				// The rate limiter would otherwise reach for a real database.
				rateLimit: false,
			} as never,
			bus,
		),
	);
	app.register(new WorkspacesModule(store, {}, bus));
	await app.boot();
	return app;
}

function callbackRequest(): Request {
	const state = 'state-abc';
	return new Request(`http://localhost/auth/google/callback?code=test-code&state=${state}`, {
		headers: { cookie: `oauth_state=${state}` },
	});
}

function mockGoogle() {
	return mock.method(
		globalThis,
		'fetch',
		async () =>
			new Response(JSON.stringify({ id_token: fakeIdToken(ID_CLAIMS) }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			}),
	);
}

test('a Google sign-up provisions a personal workspace (auth -> bus -> workspaces)', async () => {
	const seen: string[] = [];
	const store = makeStore(seen, { id: 'user-1', inserted: true, previousProvider: null });
	const app = await bootApp(store);

	const fetchMock = mockGoogle();
	const response = await app.handle(callbackRequest());
	fetchMock.mock.restore();

	assert.equal(response.status, 200, 'the sign-in itself must succeed');
	assert.ok(
		seen.some((s) => s.includes('INSERT INTO fonderie_workspaces') && s.includes('is_personal')),
		'a Google sign-up must end with a personal workspace — the assertion that was missing ' +
			'while OAuth users silently got none',
	);
});

test('a returning Google sign-in provisions nothing', async () => {
	// The other half of the contract, and why the controller cannot simply emit
	// user.registered unconditionally: this path runs on EVERY sign-in, so
	// emitting here would hand the user another personal workspace each time.
	const seen: string[] = [];
	const store = makeStore(seen, { id: 'user-1', inserted: false, previousProvider: 'google' });
	const app = await bootApp(store);

	const fetchMock = mockGoogle();
	const response = await app.handle(callbackRequest());
	fetchMock.mock.restore();

	assert.equal(response.status, 200);
	assert.ok(
		!seen.some((s) => s.includes('INSERT INTO fonderie_workspaces')),
		'signing in again is not registering — no second personal workspace',
	);
});
