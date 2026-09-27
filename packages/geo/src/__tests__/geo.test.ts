import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsvLine, parseBlocksCsv, parseLocationsCsv, parseAsnCsv, ingestAsnBlocks } from '../ingest.js';
import { PostgresGeoProvider, __resetAsnWarningForTests } from '../provider.js';
import type { Queryable } from '../types.js';

// ── CSV parsing ───────────────────────────────────────────────────

test('parseCsvLine: plain, quoted-with-comma, and escaped quotes', () => {
	assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']);
	assert.deepEqual(parseCsvLine('1,"Washington, D.C.",x'), ['1', 'Washington, D.C.', 'x']);
	assert.deepEqual(parseCsvLine('"say ""hi""",y'), ['say "hi"', 'y']);
	assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']); // empty field preserved
});

test('parseBlocksCsv: maps MaxMind block columns, skips header + blanks', () => {
	const csv =
		'network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider,postal_code,latitude,longitude,accuracy_radius\n' +
		'1.2.3.0/24,6252001,6252001,,0,0,98101,47.6062,-122.3321,20\n' +
		'2001:db8::/32,2921044,,,0,0,,51.2993,9.491,100\n' +
		'\n';
	const rows = parseBlocksCsv(csv);
	assert.equal(rows.length, 2);
	assert.deepEqual(rows[0], { network: '1.2.3.0/24', geonameId: 6252001, postalCode: '98101', latitude: 47.6062, longitude: -122.3321, accuracyRadius: 20 });
	assert.equal(rows[1]?.network, '2001:db8::/32'); // IPv6 block parsed
	assert.equal(rows[1]?.geonameId, 2921044);
	assert.equal(rows[1]?.postalCode, null); // empty column → null
});

test('parseLocationsCsv: maps name columns incl. quoted city', () => {
	const csv =
		'geoname_id,locale_code,continent_code,continent_name,country_iso_code,country_name,subdivision_1_iso_code,subdivision_1_name,subdivision_2_iso_code,subdivision_2_name,city_name,metro_code,time_zone,is_in_european_union\n' +
		'5809844,en,NA,"North America",US,United States,WA,Washington,,,Seattle,819,America/Los_Angeles,0\n';
	const [r] = parseLocationsCsv(csv);
	assert.equal(r?.geonameId, 5809844);
	assert.equal(r?.countryIso, 'US');
	assert.equal(r?.subdivisionIso, 'WA');
	assert.equal(r?.cityName, 'Seattle');
	assert.equal(r?.continentCode, 'NA');
	assert.equal(r?.timeZone, 'America/Los_Angeles');
});

// ── provider guard + row mapping ──────────────────────────────────

function fakeStore(row?: Record<string, unknown>): Queryable & { queried: boolean } {
	return {
		queried: false,
		async query<T>(): Promise<T[]> {
			this.queried = true;
			return (row ? [row] : []) as T[];
		},
	};
}

test('lookup: obviously-invalid input returns null WITHOUT hitting the store', async () => {
	for (const bad of ['', '   ', 'not-an-ip', 'drop table;', 'x'.repeat(60)]) {
		const store = fakeStore({ country_iso: 'US' });
		const r = await new PostgresGeoProvider(store).lookup(bad);
		assert.equal(r, null, `expected null for ${JSON.stringify(bad)}`);
		assert.equal(store.queried, false, `must not query for ${JSON.stringify(bad)}`);
	}
});

test('lookup: a hit maps DB columns to GeoLocation', async () => {
	const store = fakeStore({
		country_iso: 'US', country_name: 'United States',
		subdivision_iso: 'WA', subdivision_name: 'Washington',
		city_name: 'Seattle', continent_code: 'NA', time_zone: 'America/Los_Angeles',
		postal_code: '98101', latitude: 47.6062, longitude: -122.3321, accuracy_radius: 20,
	});
	const r = await new PostgresGeoProvider(store).lookup('1.2.3.4');
	assert.equal(store.queried, true);
	assert.deepEqual(r, {
		country: 'US', countryName: 'United States',
		subdivision: 'WA', subdivisionName: 'Washington',
		city: 'Seattle', postalCode: '98101', continent: 'NA', timeZone: 'America/Los_Angeles',
		latitude: 47.6062, longitude: -122.3321, accuracyRadius: 20,
		asn: null, org: null, // no ASN block in this row
	});
});

test('lookup: a miss returns null', async () => {
	const r = await new PostgresGeoProvider(fakeStore()).lookup('203.0.113.7');
	assert.equal(r, null);
});

test('lookup: IPv6 passes the guard (reaches the store)', async () => {
	const store = fakeStore();
	await new PostgresGeoProvider(store).lookup('2001:db8::1');
	assert.equal(store.queried, true);
});

test('lookup: IPv4-mapped IPv6 is normalized to IPv4 before the query', async () => {
	// The bug the audit caught: ::ffff:1.2.3.4 must query with 1.2.3.4 so it
	// matches IPv4 cidr blocks, not the v6-family literal.
	let lastParam: string | undefined;
	const store: Queryable = {
		async query<T>(_sql: string, params?: unknown[]): Promise<T[]> {
			lastParam = params?.[0] as string;
			return [] as T[];
		},
	};
	await new PostgresGeoProvider(store).lookup('::ffff:203.0.113.7');
	assert.equal(lastParam, '203.0.113.7');
	// A normal IPv6 address is left intact.
	await new PostgresGeoProvider(store).lookup('2001:db8::1');
	assert.equal(lastParam, '2001:db8::1');
});

test('lookup: an unexpected (non-22P02) error is logged, not silently swallowed', async () => {
	const logged: unknown[] = [];
	const orig = console.error;
	console.error = (...a: unknown[]) => { logged.push(a); };
	try {
		const store: Queryable = { async query() { throw Object.assign(new Error('connection reset'), { code: '08006' }); } };
		const r = await new PostgresGeoProvider(store).lookup('1.2.3.4');
		assert.equal(r, null); // still returns null (caller not crashed)
		assert.equal(logged.length, 1, 'a real fault must be logged');
	} finally {
		console.error = orig;
	}
});

test('lookup: an invalid-inet cast error (22P02) is NOT logged (expected)', async () => {
	const logged: unknown[] = [];
	const orig = console.error;
	console.error = (...a: unknown[]) => { logged.push(a); };
	try {
		const store: Queryable = { async query() { throw Object.assign(new Error('invalid input syntax for type inet'), { code: '22P02' }); } };
		const r = await new PostgresGeoProvider(store).lookup('1.2.3.4.5');
		assert.equal(r, null);
		assert.equal(logged.length, 0, 'a bad-IP cast is expected → no noise');
	} finally {
		console.error = orig;
	}
});

test('blockRowFromLine: falls back to registered_country_geoname_id when geoname_id is empty', () => {
	// network, geoname_id(empty), registered_country_geoname_id, represented…, …
	const row = parseBlocksCsv(
		'network,geoname_id,registered_country_geoname_id,represented_country_geoname_id,is_anonymous_proxy,is_satellite_provider,postal_code,latitude,longitude,accuracy_radius\n' +
			'5.6.7.0/24,,6252001,,0,0,,0,0,50\n',
	)[0];
	assert.equal(row?.geonameId, 6252001, 'registered-country geoname used when city geoname is absent');
});

test('ingestBlocks: placeholders match the column list (postal_code included)', async () => {
	const { ingestBlocks } = await import('../ingest.js');
	const seen: { sql: string; params: unknown[] }[] = [];
	const store = { query: async (sql: string, params?: unknown[]) => { seen.push({ sql, params: params ?? [] }); return []; } };
	await ingestBlocks(store, [
		{ network: '1.2.3.0/24', geonameId: 1, postalCode: '98101', latitude: 1, longitude: 2, accuracyRadius: 20 },
		{ network: '1.2.4.0/24', geonameId: 2, postalCode: null, latitude: 3, longitude: 4, accuracyRadius: 50 },
	]);
	const { sql, params } = seen[0]!;
	const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').length;
	const placeholders = (sql.match(/\$\d+/g) ?? []).length;
	assert.equal(columns, 6);
	assert.equal(placeholders, 2 * columns, 'one placeholder per column per row');
	assert.equal(params.length, placeholders);
	assert.equal(params[2], '98101');
});

// ── ASN (GeoLite2 ASN database) ──────────────────────────────────

test('parseAsnCsv: maps network / number / organization; skips rows without a number', () => {
	const rows = parseAsnCsv(
		'network,autonomous_system_number,autonomous_system_organization\n' +
			'64.233.160.0/19,15169,"Google LLC"\n' +
			'2001:4860::/32,15169,Google LLC\n' +
			'198.51.100.0/24,,Nobody\n' +
			'\n',
	);
	assert.equal(rows.length, 2);
	assert.deepEqual(rows[0], { network: '64.233.160.0/19', asn: 15169, organization: 'Google LLC' });
	assert.equal(rows[1]?.network, '2001:4860::/32');
});

test('ingestAsnBlocks: three columns, three placeholders per row', async () => {
	const seen: { sql: string; params: unknown[] }[] = [];
	const store = { query: async (sql: string, params?: unknown[]) => { seen.push({ sql, params: params ?? [] }); return []; } };
	await ingestAsnBlocks(store, [
		{ network: '64.233.160.0/19', asn: 15169, organization: 'Google LLC' },
		{ network: '2001:4860::/32', asn: 15169, organization: null },
	]);
	const { sql, params } = seen[0]!;
	assert.match(sql, /INSERT INTO geo_asn_blocks \(network, asn, organization\)/);
	assert.equal((sql.match(/\$\d+/g) ?? []).length, 6);
	assert.deepEqual(params, ['64.233.160.0/19', 15169, 'Google LLC', '2001:4860::/32', 15169, null]);
});

test('lookup: one query returns City and ASN together; asn is rendered "AS…"', async () => {
	const sqls: string[] = [];
	const store: Queryable = {
		async query<T>(sql: string): Promise<T[]> {
			sqls.push(sql);
			return [{ country_iso: 'US', city_name: 'Mountain View', asn: '15169', organization: 'Google LLC' }] as T[];
		},
	};
	const r = await new PostgresGeoProvider(store).lookup('64.233.178.102');
	assert.equal(sqls.length, 1, 'a single round trip');
	assert.match(sqls[0]!, /geo_asn_blocks/);
	assert.equal(r?.asn, 'AS15169');
	assert.equal(r?.org, 'Google LLC');
	assert.equal(r?.city, 'Mountain View');
});

test('lookup: an ASN hit with no City block still returns the network facts', async () => {
	const r = await new PostgresGeoProvider(fakeStore({ asn: 15169, organization: 'Google LLC' })).lookup('64.233.178.102');
	assert.equal(r?.asn, 'AS15169');
	assert.equal(r?.country, null);
});

test('lookup: an all-null row (address in neither dataset) is null, not an empty location', async () => {
	const r = await new PostgresGeoProvider(fakeStore({ country_iso: null, asn: null, organization: null })).lookup('203.0.113.7');
	assert.equal(r, null);
});

test('lookup: before migration 003, City keeps working and the gap is announced once', async () => {
	__resetAsnWarningForTests();
	const warned: unknown[] = [];
	const orig = console.warn;
	console.warn = (...a: unknown[]) => { warned.push(a); };
	try {
		const store: Queryable = {
			async query<T>(sql: string): Promise<T[]> {
				if (sql.includes('geo_asn_blocks')) throw Object.assign(new Error('relation "geo_asn_blocks" does not exist'), { code: '42P01' });
				return [{ country_iso: 'US', city_name: 'Mountain View' }] as T[];
			},
		};
		const p = new PostgresGeoProvider(store);
		const a = await p.lookup('64.233.178.102');
		const b = await p.lookup('64.233.178.102');
		assert.equal(a?.city, 'Mountain View');
		assert.equal(a?.asn, null);
		assert.equal(b?.city, 'Mountain View');
		assert.equal(warned.length, 1, 'warned once, not per lookup');
	} finally {
		console.warn = orig;
	}
});
