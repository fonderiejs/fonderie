import { test } from 'node:test';
import assert from 'node:assert/strict';

import { geoFromHeaders } from '../headers.js';

// ── trust is explicit ─────────────────────────────────────────────

const VERCEL = {
	'x-vercel-ip-country': 'CA',
	'x-vercel-ip-country-region': 'QC',
	'x-vercel-ip-city': 'Montr%C3%A9al',
	'x-vercel-ip-postal-code': 'h2x',
	'x-vercel-ip-continent': 'NA',
	'x-vercel-ip-timezone': 'America/Toronto',
	'x-vercel-ip-latitude': '45.5019',
	'x-vercel-ip-longitude': '-73.5674',
};

test('geoFromHeaders: no trusted source → null, even with perfect headers', () => {
	assert.equal(geoFromHeaders(VERCEL, { trust: undefined }), null);
	assert.equal(geoFromHeaders(VERCEL, { trust: null }), null);
	assert.equal(geoFromHeaders(VERCEL, { trust: [] }), null);
});

test('geoFromHeaders: trusting cloudflare ignores vercel headers (and vice versa)', () => {
	assert.equal(geoFromHeaders(VERCEL, { trust: 'cloudflare' }), null);
	assert.equal(geoFromHeaders({ 'cf-ipcountry': 'FR' }, { trust: 'vercel' }), null);
});

// ── vercel ────────────────────────────────────────────────────────

test('geoFromHeaders: vercel headers map onto GeoLocation; city is percent-decoded', () => {
	const loc = geoFromHeaders(VERCEL, { trust: 'vercel' });
	assert.deepEqual(loc, {
		country: 'CA',
		countryName: null,
		subdivision: 'QC',
		subdivisionName: null,
		city: 'Montréal',
		postalCode: 'H2X',
		continent: 'NA',
		timeZone: 'America/Toronto',
		latitude: 45.5019,
		longitude: -73.5674,
		accuracyRadius: null,
		geonameId: null,
		asn: null,
		org: null,
	});
});

test('geoFromHeaders: reads a Fetch Headers object and Node array-valued headers alike', () => {
	const h = new Headers({ 'x-vercel-ip-country': 'us', 'x-vercel-ip-city': 'Austin' });
	assert.equal(geoFromHeaders(h, { trust: 'vercel' })?.country, 'US');
	assert.equal(geoFromHeaders(h, { trust: 'vercel' })?.city, 'Austin');
	const node = { 'x-vercel-ip-country': ['DE', 'FR'] as string[] };
	assert.equal(geoFromHeaders(node, { trust: 'vercel' })?.country, 'DE');
});

test('geoFromHeaders: malformed values become null fields, never throw', () => {
	const loc = geoFromHeaders(
		{
			'x-vercel-ip-country': 'USA', // three letters is not alpha-2
			'x-vercel-ip-country-region': 'Québec', // not an ISO-3166-2 code
			'x-vercel-ip-city': '%E0%A4%A', // truncated percent-encoding
			'x-vercel-ip-timezone': 'not a zone',
			'x-vercel-ip-latitude': '91', // out of range
			'x-vercel-ip-longitude': 'abc',
		},
		{ trust: 'vercel' },
	);
	assert.ok(loc, 'a city string survived, so the location is not null');
	assert.equal(loc.country, null);
	assert.equal(loc.subdivision, null);
	assert.equal(loc.city, '%E0%A4%A'); // undecodable → kept verbatim, still bounded text
	assert.equal(loc.timeZone, null);
	assert.equal(loc.latitude, null);
	assert.equal(loc.longitude, null);
});

test('geoFromHeaders: a trusted source that set nothing usable → null', () => {
	assert.equal(geoFromHeaders({}, { trust: 'vercel' }), null);
	assert.equal(geoFromHeaders({ 'x-vercel-ip-country': '' }, { trust: 'vercel' }), null);
	assert.equal(geoFromHeaders({ 'x-vercel-ip-city': 'x'.repeat(129) }, { trust: 'vercel' }), null);
});

// ── cloudflare ────────────────────────────────────────────────────

test('geoFromHeaders: cloudflare country on its own is enough; XX/T1 mean unknown', () => {
	assert.equal(geoFromHeaders({ 'cf-ipcountry': 'fr' }, { trust: 'cloudflare' })?.country, 'FR');
	assert.equal(geoFromHeaders({ 'cf-ipcountry': 'XX' }, { trust: 'cloudflare' }), null);
	assert.equal(geoFromHeaders({ 'cf-ipcountry': 'T1' }, { trust: 'cloudflare' }), null);
});

test('geoFromHeaders: several trusted sources are tried in order; the first that knows something wins', () => {
	const both = { 'cf-ipcountry': 'FR', 'x-vercel-ip-country': 'CA' };
	assert.equal(geoFromHeaders(both, { trust: ['vercel', 'cloudflare'] })?.country, 'CA');
	assert.equal(geoFromHeaders(both, { trust: ['cloudflare', 'vercel'] })?.country, 'FR');
	// the first source knows nothing → fall through to the second
	assert.equal(geoFromHeaders({ 'cf-ipcountry': 'FR' }, { trust: ['vercel', 'cloudflare'] })?.country, 'FR');
});
