import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { authController } from '../controllers/auth.controller';
import { toLoginHistoryPageDTO } from '../dtos/login-activity';
import { LoginEventModel } from '../models/login-event.model';
import { resolveLocation, sanitizeLocation } from '../services/request-location';

type Captured = { sql: string; params: unknown[] };
function capturingStore(onQuery?: (c: Captured) => unknown[] | undefined) {
	const calls: Captured[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			const c = { sql, params: params ?? [] };
			calls.push(c);
			return (onQuery?.(c) ?? []) as unknown as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, calls };
}

// The shape a hosted IP-intelligence API gives after the app maps it (a public
// Google address — never use a real person's IP in fixtures).
const GOOGLE_EXAMPLE = {
	country: 'us',
	countryName: 'United States',
	subdivision: 'ca',
	subdivisionName: 'California',
	city: 'Mountain View',
	postalCode: '94043',
	continent: 'NA',
	timeZone: 'America/Los_Angeles',
	latitude: 37.4225,
	longitude: -122.085,
	accuracyRadius: 20.4,
	geonameId: 5375480,
	isp: 'Google LLC',
	org: 'Google LLC',
	asn: 'as15169',
	mobile: false,
	proxy: false,
	hosting: true,
};

// ── sanitize ─────────────────────────────────────────────────────

test('sanitizeLocation: normalises codes, rounds coordinates to ~1 km, keeps booleans', () => {
	assert.deepEqual(sanitizeLocation(GOOGLE_EXAMPLE), {
		country: 'US',
		countryName: 'United States',
		subdivision: 'CA',
		subdivisionName: 'California',
		city: 'Mountain View',
		postalCode: '94043',
		continent: 'NA',
		timeZone: 'America/Los_Angeles',
		latitude: 37.42,
		longitude: -122.08,
		accuracyRadius: 20,
		geonameId: 5375480,
		isp: 'Google LLC',
		org: 'Google LLC',
		asn: 'AS15169',
		mobile: false,
		proxy: false,
		hosting: true,
	});
});

test('sanitizeLocation: geonameId accepts node-pg BIGINT strings, rejects non-ids', () => {
	assert.equal(sanitizeLocation({ geonameId: '5375480' })?.geonameId, 5375480);
	assert.equal(sanitizeLocation({ geonameId: 5375480 })?.geonameId, 5375480);
	for (const bad of [0, -1, 1.5, '12a', '99999999999', 2 ** 31]) {
		assert.equal(sanitizeLocation({ geonameId: bad }), null, `rejects ${String(bad)}`);
	}
});

test('sanitizeLocation: malformed or oversized fields are dropped, not stored', () => {
	assert.deepEqual(
		sanitizeLocation({
			country: 'Canada', // not alpha-2
			city: 'x'.repeat(129),
			postalCode: '<94043>',
			latitude: 123, // out of range
			accuracyRadius: -5,
			geonameId: 1.5,
			asn: 'five',
			proxy: 'no', // not a boolean
			timeZone: '<script>',
			subdivision: 'CA',
		}),
		{ subdivision: 'CA' },
	);
	assert.equal(sanitizeLocation({}), null);
	assert.equal(sanitizeLocation(null), null);
	assert.equal(sanitizeLocation('CA'), null);
});

// ── resolver contract ────────────────────────────────────────────

test('resolveLocation: passes ip + headers; no resolver → null', async () => {
	const headers = new Headers({ 'x-vercel-ip-country': 'US' });
	let seen: { ip: string | null; headers: Headers } | undefined;
	const loc = await resolveLocation(
		(req) => {
			seen = req;
			return { country: req.headers.get('x-vercel-ip-country') };
		},
		{ ip: '203.0.113.7', headers },
	);
	assert.deepEqual(loc, { country: 'US' });
	assert.equal(seen?.ip, '203.0.113.7');
	assert.equal(seen?.headers, headers);
	assert.equal(await resolveLocation(undefined, { ip: null, headers }), null);
});

test('resolveLocation: a throwing resolver yields null (never throws)', async () => {
	const warn = console.warn;
	console.warn = () => {};
	try {
		const loc = await resolveLocation(
			() => {
				throw new Error('provider down');
			},
			{ ip: null, headers: new Headers() },
		);
		assert.equal(loc, null);
	} finally {
		console.warn = warn;
	}
});

test('resolveLocation: a stalled resolver is abandoned at the timeout', async () => {
	const started = Date.now();
	const loc = await resolveLocation(() => new Promise(() => {}), { ip: null, headers: new Headers() }, 50);
	assert.equal(loc, null);
	assert.ok(Date.now() - started < 1000, 'returned promptly after the timeout');
});

// ── model ────────────────────────────────────────────────────────

test('LoginEventModel.record: stores the sanitized location as JSON in the 8th param', async () => {
	const { store, calls } = capturingStore();
	await new LoginEventModel(store, () => GOOGLE_EXAMPLE).record({
		userId: 'u1',
		method: 'oauth-google',
		outcome: 'success',
		ipAddress: '64.233.178.102',
		userAgent: 'UA',
		headers: new Headers(),
	});
	assert.match(calls[0]!.sql, /ip_address, user_agent, location\)/);
	const stored = JSON.parse(calls[0]!.params[7] as string);
	assert.equal(stored.city, 'Mountain View');
	assert.equal(stored.country, 'US');
	assert.equal(stored.asn, 'AS15169');
});

test('LoginEventModel.record: a resolver that knows nothing stores NULL', async () => {
	const { store, calls } = capturingStore();
	await new LoginEventModel(store, () => null).record({
		userId: 'u1',
		method: 'password',
		outcome: 'success',
		ipAddress: null,
		userAgent: null,
	});
	assert.equal(calls[0]!.params[7], null);
});

test('LoginEventModel.listByUser: selects the location column', async () => {
	const { store, calls } = capturingStore(() => []);
	await new LoginEventModel(store).listByUser({ userId: 'u1' });
	assert.match(calls[0]!.sql, /user_agent AS "userAgent", location,/);
});

// ── DTO ──────────────────────────────────────────────────────────

test('toLoginHistoryPageDTO: exposes location, re-sanitized on read; absent → null', () => {
	const base = {
		id: 'e1',
		method: 'password' as const,
		outcome: 'success' as const,
		failureReason: null,
		ipAddress: '64.233.178.102',
		userAgent: 'UA',
		createdAt: new Date('2026-09-26T17:45:00Z'),
		createdAtRaw: '2026-09-26 17:45:00+00',
	};
	const page = toLoginHistoryPageDTO({
		events: [
			{ ...base, location: { country: 'US', city: 'Mountain View', injected: '<b>' } as never },
			{ ...base, id: 'e2', location: null },
		],
		hasMore: false,
	});
	assert.deepEqual(page.events[0]!.location, { country: 'US', city: 'Mountain View' });
	assert.equal(page.events[1]!.location, null);
});

// ── end to end through the controller: config reaches the row ────

test('login: IAuthConfig.location is called with the request and its result is recorded', async () => {
	const inserts: Captured[] = [];
	const { store } = capturingStore((c) => {
		if (c.sql.includes('fonderie_login_events')) inserts.push(c);
		return []; // unknown email → failed attempt, still recorded
	});
	const config = {
		jwtSecret: 'a'.repeat(48),
		providers: ['email'],
		appName: 'Test',
		location: ({ headers }) => ({ country: headers.get('x-vercel-ip-country'), city: 'Mountain View' }),
	} as IAuthConfig;
	const res = await authController(store, config).login({
		user: null,
		workspace: null,
		tenant: null,
		meta: { body: { email: 'nobody@example.com', password: 'x' }, clientIp: '64.233.178.102' },
		request: new Request('http://localhost/', { headers: { 'x-vercel-ip-country': 'US' } }),
	} as never);
	assert.equal(res.status, 401);
	await new Promise((r) => setImmediate(r));
	assert.equal(inserts.length, 1);
	assert.deepEqual(JSON.parse(inserts[0]!.params[7] as string), { country: 'US', city: 'Mountain View' });
});

// ── sessions + registration + one resolution per request ─────────

import { SessionModel } from '../models/session.model';
import { toSessionDTO } from '../dtos/login-activity';

test('SessionModel.create: stores the resolved location; Active Sessions DTO exposes it', async () => {
	const { store, calls } = capturingStore();
	await new SessionModel(store, () => GOOGLE_EXAMPLE).create('u1', 'tok', new Date('2027-01-01Z'), 'sid-1', {
		ipAddress: '64.233.178.102',
		userAgent: 'UA',
		headers: new Headers(),
	});
	assert.match(calls[0]!.sql, /user_agent, ip_address, location\)/);
	assert.equal(JSON.parse(calls[0]!.params[6] as string).city, 'Mountain View');
	const dto = toSessionDTO(
		{
			id: 's1',
			sid: 'sid-1',
			userAgent: 'UA',
			ipAddress: '64.233.178.102',
			location: { city: 'Mountain View', country: 'US', junk: 1 },
			createdAt: new Date(),
			expiresAt: new Date(),
		},
		'sid-1',
	);
	assert.deepEqual(dto.location, { city: 'Mountain View', country: 'US' });
});

test('resolveLocation: one request resolves once, however many rows ask', async () => {
	let calls = 0;
	const resolver = () => {
		calls += 1;
		return { country: 'US' };
	};
	const headers = new Headers();
	const a = await resolveLocation(resolver, { ip: null, headers });
	const b = await resolveLocation(resolver, { ip: null, headers });
	await resolveLocation(resolver, { ip: null, headers: new Headers() }); // a different request
	assert.deepEqual(a, b);
	assert.equal(calls, 2, 'once for the first request, once for the second');
});

test('register: records a "registration" event with the location, resolving once for session + event', async () => {
	const eventInserts: Captured[] = [];
	const sessionInserts: Captured[] = [];
	let resolved = 0;
	const { store } = capturingStore((c) => {
		if (c.sql.includes('INSERT INTO fonderie_login_events')) eventInserts.push(c);
		if (c.sql.includes('INSERT INTO fonderie_sessions')) sessionInserts.push(c);
		if (/INSERT INTO fonderie_users/.test(c.sql)) return [{ id: 'u-new' }];
		if (/FROM fonderie_users/.test(c.sql) && c.params[0] === 'u-new')
			return [{ id: 'u-new', email: 'new@example.com', first_name: null, last_name: null, locale: 'en' }];
		return [];
	});
	const config = {
		jwtSecret: 'a'.repeat(48),
		providers: ['email'],
		appName: 'Test',
		location: () => {
			resolved += 1;
			return { country: 'US', city: 'Mountain View' };
		},
	} as IAuthConfig;
	const res = await authController(store, config).register({
		user: null,
		workspace: null,
		tenant: null,
		meta: { body: { email: 'new@example.com', password: 'long-enough-pw' }, clientIp: '64.233.178.102' },
		request: new Request('http://localhost/', { headers: { 'user-agent': 'UA' } }),
	} as never);
	assert.equal(res.status, 201);
	await new Promise((r) => setImmediate(r));
	assert.equal(sessionInserts.length, 1);
	assert.equal(eventInserts.length, 1);
	assert.equal(eventInserts[0]!.params[2], 'registration');
	assert.equal(eventInserts[0]!.params[3], 'success');
	assert.deepEqual(JSON.parse(eventInserts[0]!.params[7] as string), { country: 'US', city: 'Mountain View' });
	assert.equal(resolved, 1, 'session and event share one resolution');
});
