// The product name in email is the app the RECIPIENT signed up for.
//
// It used to be EMAIL_THEME.brand — a compile-time constant — so every app built
// on Fonderie sent mail headed "Fonderie". A user of LeadEasyGen has never heard
// of Fonderie, so that reads as a different company at best and as phishing at
// worst, which is the wrong signal on a receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EMAIL_LAYOUT, EMAIL_THEME, wrapLayout } from '../templates/layout';

const BODY = '<h1>Thanks for your purchase</h1>';

/** Mirrors composeHtml's interpolation: escaped values over the wrapped shell. */
function compose(data: Record<string, unknown>): string {
	const esc = (v: unknown) =>
		String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	const merged = { subject: '', preheader: '', brandName: EMAIL_THEME.brand, ...data };
	return wrapLayout(BODY, DEFAULT_EMAIL_LAYOUT).replace(/\{\{(\w+)\}\}/g, (_m, k) =>
		k in merged ? esc((merged as Record<string, unknown>)[k]) : '',
	);
}

test('the app name replaces the framework name everywhere it appeared', () => {
	const html = compose({ brandName: 'LeadEasyGen' });
	// Header and the in-card footer line — the two places the constant was used.
	assert.match(html, /email-brand[^>]*>LeadEasyGen</, 'card header must show the app name');
	assert.match(html, /used this address at LeadEasyGen\./, 'footer must name the app');
	// The ONLY surviving mention of the framework is the attribution.
	const mentions = html.match(/Fonderie/g) ?? [];
	assert.equal(mentions.length, 1, `expected exactly one Fonderie mention, got ${mentions.length}`);
	assert.match(html, /Powered by <a /, 'the attribution must survive as a link');
});

test('an app that sets nothing still gets a branded shell, never an empty one', () => {
	// The failure this guards: a missing variable interpolating to '' would leave
	// a blank heading, which looks broken rather than unbranded.
	const html = compose({});
	assert.match(html, /email-brand[^>]*>Fonderie</);
	assert.doesNotMatch(html, /email-brand[^>]*><\/span>/, 'heading must never be empty');
});

test('the attribution sits OUTSIDE the card, not inside it', () => {
	const html = compose({ brandName: 'LeadEasyGen' });
	const cardEnd = html.indexOf('</td>', html.indexOf('class="email-card"'));
	const powered = html.indexOf('Powered by');
	assert.ok(powered > cardEnd, 'attribution must render after the card closes');
});

test('the attribution links to the project site, and says Fonderie', () => {
	// The link is what makes the attribution work: "Fonderie" is a common French
	// noun, so a curious reader who searches it finds metal foundries. Without
	// somewhere to click, the line is decoration.
	//
	// The visible text stays "Fonderie" — NOT "FonderieJS". The -js suffix reads
	// as "JavaScript library", which is the wrong shape for a self-hosted backend.
	// The domain carries the js so the brand does not have to.
	const html = compose({ brandName: 'LeadEasyGen' });
	assert.match(html, /Powered by <a href="https:\/\/fonderiejs\.com"[^>]*>Fonderie<\/a>/);
	assert.doesNotMatch(html, /FonderieJS/, 'the brand is Fonderie, not a library name');
});

test('a brand name with markup cannot break the shell', () => {
	const html = compose({ brandName: '<script>x</script> & Co' });
	assert.doesNotMatch(html, /<script>x<\/script>/, 'must be escaped, not injected');
	assert.match(html, /&lt;script&gt;/);
	assert.match(html, /&amp; Co/);
});

test('a full-document template still bypasses the shell untouched', () => {
	// An app that stores a complete HTML document owns its own frame; wrapping it
	// would produce nested <html> documents.
	const doc = '<!doctype html><html><body>mine</body></html>';
	assert.equal(wrapLayout(doc, DEFAULT_EMAIL_LAYOUT), doc);
});
