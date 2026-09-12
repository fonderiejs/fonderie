import { test } from 'node:test';
import assert from 'node:assert/strict';

import { corsHeadersFor, normalizeOrigin, resolveCorsOptions } from '../middlewares/cors';

// An Origin header is scheme://host[:port] — RFC 6454 gives it no path and no
// trailing slash. So a configured origin carrying one can never match anything,
// which makes it a typo rather than intent. It is also the typo everyone makes,
// because every address bar and "copy URL" button includes the slash. Left
// alone it fails as a TOTAL outage with a misleading message: the browser
// blocks every request and the app reports "can't reach the server".

const ORIGIN = 'https://leadeasygen-app.vercel.app';
const allow = (configured: unknown, requestOrigin = ORIGIN) =>
	corsHeadersFor(
		resolveCorsOptions({ origin: configured as string, credentials: true }),
		requestOrigin,
	)['Access-Control-Allow-Origin'];

test('a trailing slash in the configured origin no longer breaks every request', () => {
	assert.equal(allow(`${ORIGIN}/`), ORIGIN);
	assert.equal(allow(`${ORIGIN}//`), ORIGIN, 'even a doubled slash');
});

test('surrounding whitespace and casing are tolerated', () => {
	assert.equal(allow(`  ${ORIGIN}  `), ORIGIN);
	assert.equal(allow('https://LeadEasyGen-App.Vercel.App'), ORIGIN);
});

test('the echoed value is the REQUEST origin, byte-for-byte', () => {
	// The browser compares against what it sent; echoing our normalized
	// spelling would fail the very check normalizing is meant to survive.
	assert.equal(allow(`${ORIGIN}/`, ORIGIN), ORIGIN);
});

test('a genuinely different origin is still refused', () => {
	assert.equal(allow(ORIGIN, 'https://evil.example.com'), undefined);
	assert.equal(allow(ORIGIN, 'https://leadeasygen-app.vercel.app.evil.com'), undefined);
});

test('a list covers apex + www, which one string cannot express', () => {
	const both = ['https://leadeasygen.com/', 'https://www.leadeasygen.com'];
	assert.equal(allow(both, 'https://leadeasygen.com'), 'https://leadeasygen.com');
	assert.equal(allow(both, 'https://www.leadeasygen.com'), 'https://www.leadeasygen.com');
	assert.equal(allow(both, 'https://other.com'), undefined);
});

test('Vary: Origin is set whenever the value depends on the request', () => {
	const vary = (o: unknown) =>
		corsHeadersFor(resolveCorsOptions({ origin: o as string }), ORIGIN)['Vary'];
	assert.equal(vary(ORIGIN), 'Origin', 'single origin still varies — it can be omitted');
	assert.equal(vary([ORIGIN]), 'Origin');
	assert.equal(vary(() => true), 'Origin');
	assert.equal(vary('*'), undefined, "only '*' is request-independent");
});

test('credentials + wildcard still fails at boot, including inside a list', () => {
	assert.throws(() => resolveCorsOptions({ credentials: true, origin: '*' }), /origin/);
	assert.throws(() => resolveCorsOptions({ credentials: true, origin: ['*'] as never }), /origin/);
});

test('normalizeOrigin: a path is reported, not silently reshaped away', () => {
	const warnings: string[] = [];
	const original = console.warn;
	console.warn = (m: string) => warnings.push(m);
	try {
		assert.equal(normalizeOrigin('https://x.com/app'), 'https://x.com');
	} finally {
		console.warn = original;
	}
	assert.match(warnings.join(' '), /contains a path/);
});
