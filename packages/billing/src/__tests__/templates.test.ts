import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IDefaultTemplate } from '@fonderie/core';

import { MESSAGE_KEYS } from '../config';
import { DEFAULT_TEMPLATES, SAMPLE_PAYLOADS } from '../templates';
import { formatWalletAmount } from '../utils';
import { buildReceiptData } from '../services/receipt';

// ── formatWalletAmount ────────────────────────────────────────────

test('formatWalletAmount: money wallet (precision 2) → currency string', () => {
	assert.equal(formatWalletAmount(1999n, 'USD', 2), '$19.99');
	assert.equal(formatWalletAmount(0n, 'USD', 2), '$0.00');
	assert.equal(formatWalletAmount(500n, 'usd', 2), '$5.00'); // currency normalized
});

test('formatWalletAmount: zero-decimal ISO currency (JPY) formats without cents', () => {
	assert.equal(formatWalletAmount(500n, 'JPY', 0), '¥500');
});

test('formatWalletAmount: code-symbol currencies keep their label (regression: no strip)', () => {
	// These render with the 3-letter code AS the symbol in en-US; an earlier
	// heuristic wrongly stripped it, dropping the currency entirely. (Intl uses a
	// non-breaking space between code and amount, so match on substrings.)
	const chf = formatWalletAmount(500n, 'CHF', 2);
	assert.ok(
		chf.includes('CHF') && chf.includes('5.00'),
		`CHF label kept, got ${JSON.stringify(chf)}`,
	);
	const sek = formatWalletAmount(500n, 'SEK', 2);
	assert.ok(
		sek.includes('SEK') && sek.includes('5.00'),
		`SEK label kept, got ${JSON.stringify(sek)}`,
	);
});

test('formatWalletAmount: malformed (non-ISO) code → bare number, never throws', () => {
	// A credits wallet using a code Intl rejects (not 3 ASCII letters) falls back
	// to the plain major-unit number; an app wanting a nicer unit overrides.
	assert.equal(formatWalletAmount(500n, 'CREDITS', 0), '500');
	assert.equal(formatWalletAmount(1999n, 'CREDITS', 2), '19.99');
});

test('formatWalletAmount: unbounded balance past 2^53 degrades to the raw integer, never throws', () => {
	const huge = 9_007_199_254_740_993n; // > Number.MAX_SAFE_INTEGER
	assert.equal(formatWalletAmount(huge, 'USD', 2), huge.toString());
});

// ── default template coverage ─────────────────────────────────────

// Mirrors @fonderie/courier's resolver: {{var}} substitution plus {{#var}}…
// {{/var}} optional blocks.
//
// Duplicated rather than imported because billing does NOT depend on courier —
// the app wires them together, and inverting that for a test would put a
// sibling dependency into the package graph. The cost is that this must be kept
// in step with the resolver; the test below is what notices when it is not.
const VAR_RE = /\{\{(\w+)\}\}/g;
const SECTION_RE = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

// A section key IS a used variable — it must appear in the payload like any
// other, so the coverage assertion still applies to it.
const varsIn = (s: string): string[] => [...s.matchAll(/\{\{[#/]?(\w+)\}\}/g)].map((m) => m[1]!);

const render = (s: string, data: Record<string, unknown>): string =>
	s
		.replace(SECTION_RE, (_, k: string, body: string) => {
			const v = data[k];
			return v !== undefined && v !== null && String(v).trim() !== '' ? body : '';
		})
		.replace(VAR_RE, (_, k: string) => {
			const v = data[k];
			return v !== undefined && v !== null ? String(v) : '';
		});

for (const key of Object.values(MESSAGE_KEYS)) {
	test(`billing default template: ${key} — exists, vars ⊆ payload, renders clean`, () => {
		const tmpl = (
			DEFAULT_TEMPLATES as Record<string, { subject?: string; text: string; html?: string }>
		)[key];
		assert.ok(tmpl, `no default template shipped for '${key}'`);
		assert.ok(tmpl.text && tmpl.text.length > 0, `default '${key}' has empty text`);

		const sample = (SAMPLE_PAYLOADS as Record<string, Record<string, unknown>>)[key];
		assert.ok(sample, `no SAMPLE_PAYLOADS entry for '${key}'`);

		const allowed = new Set([...Object.keys(sample), 'subject', 'preheader']);
		const fields = [tmpl.subject ?? '', tmpl.text, tmpl.html ?? ''];
		for (const field of fields) {
			for (const v of varsIn(field)) {
				assert.ok(allowed.has(v), `'${key}': template uses {{${v}}} but it is not in the payload`);
			}
		}
		for (const field of fields) {
			if (field) {
				assert.ok(!render(field, sample).includes('{{'), `'${key}': unresolved '{{' after render`);
			}
		}
	});
}

test('billing: DEFAULT_TEMPLATES is assignable to courier DefaultTemplateMap (app-wiring contract)', () => {
	const map: Record<string, IDefaultTemplate> = DEFAULT_TEMPLATES;
	assert.equal(Object.keys(map).length, Object.values(MESSAGE_KEYS).length);
});

test('billing: DEFAULT_TEMPLATES and SAMPLE_PAYLOADS cover exactly the live message keys', () => {
	const keys = new Set<string>(Object.values(MESSAGE_KEYS));
	assert.deepEqual(
		new Set(Object.keys(DEFAULT_TEMPLATES)),
		keys,
		'DEFAULT_TEMPLATES key set drift',
	);
	assert.deepEqual(new Set(Object.keys(SAMPLE_PAYLOADS)), keys, 'SAMPLE_PAYLOADS key set drift');
});

test('every anchor in a default template opens in a new tab, safely', () => {
	// Same reasoning as courier's shell test, applied to the message bodies.
	// Written as a sweep so a link added to any future template is covered
	// without anyone remembering to extend this.
	for (const [key, tmpl] of Object.entries(
		DEFAULT_TEMPLATES as Record<string, { html?: string }>,
	)) {
		for (const a of tmpl.html?.match(/<a\s[^>]*>/g) ?? []) {
			assert.match(a, /target="_blank"/, `'${key}': anchor missing target="_blank": ${a}`);
			assert.match(a, /rel="[^"]*noopener/, `'${key}': anchor missing rel=noopener: ${a}`);
		}
	}
});

test('buildReceiptData supplies every variable the receipt template uses', () => {
	// The gap that shipped a blank receipt: the coverage test above validates the
	// template against SAMPLE_PAYLOADS — one idealised payload — not against what
	// the emitters actually send. Three call sites emit this message and only one
	// had been updated, so two of them rendered blank amounts. Missing variables
	// interpolate to empty, so nothing failed; the email just arrived with the
	// numbers rubbed out.
	//
	// Asserting against the SHARED builder closes it: every emitter now goes
	// through here, so if the template gains a field this fails until the builder
	// supplies it.
	const tmpl = (
		DEFAULT_TEMPLATES as Record<string, { subject?: string; text: string; html?: string }>
	)[MESSAGE_KEYS.paymentReceipt]!;
	// Minimum a caller can supply — auto-recharge knows no invoice at all.
	const minimal = buildReceiptData({
		packId: 'pack_500',
		credits: 500n,
		creditCurrency: 'USD',
		precision: 2,
		balanceAfter: 750n,
		source: 'test',
	});
	for (const field of [tmpl.subject ?? '', tmpl.text, tmpl.html ?? '']) {
		for (const v of varsIn(field)) {
			if (v === 'subject' || v === 'preheader' || v === 'brandName') continue;
			assert.ok(v in minimal, `template uses {{${v}}} but buildReceiptData never supplies it`);
		}
	}
	// And the money must be formatted, not raw minor units.
	const paid = buildReceiptData({
		packId: 'p',
		credits: 1n,
		creditCurrency: 'USD',
		precision: 0,
		balanceAfter: 1n,
		amountPaid: 3800n,
		paymentCurrency: 'usd',
		source: 'test',
	});
	assert.equal(paid['amountPaidDisplay'], '$38.00', 'money is 2dp regardless of wallet precision');
});
