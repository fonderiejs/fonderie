import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IDefaultTemplate } from '@fonderie/core';

import { MESSAGE_KEYS } from '../config';
import { DEFAULT_TEMPLATES, SAMPLE_PAYLOADS } from '../templates';

// Coverage gate for @fonderie/auth notifications: every message key the module
// can emit MUST ship a default template that renders cleanly with its real
// payload. The `satisfies Record<AuthMessageKey, IDefaultTemplate>` in
// templates.ts already makes a missing key a compile error; this proves the
// content actually renders (no var/payload drift, no unresolved {{...}}).

// Mirror courier's resolver render() exactly: /\{\{(\w+)\}\}/g substitution.
const VAR_RE = /\{\{(\w+)\}\}/g;
const varsIn = (s: string): string[] => [...s.matchAll(VAR_RE)].map((m) => m[1]!);
const render = (s: string, data: Record<string, unknown>): string =>
	s.replace(VAR_RE, (_, k: string) => {
		const v = data[k];
		return v !== undefined && v !== null ? String(v) : '';
	});

for (const key of Object.values(MESSAGE_KEYS)) {
	test(`auth default template: ${key} — exists, vars ⊆ payload, renders clean`, () => {
		const tmpl = (DEFAULT_TEMPLATES as Record<string, { subject?: string; text: string; html?: string }>)[key];
		assert.ok(tmpl, `no default template shipped for '${key}'`);
		assert.ok(tmpl.text && tmpl.text.length > 0, `default '${key}' has empty text`);

		const sample = (SAMPLE_PAYLOADS as Record<string, Record<string, unknown>>)[key];
		assert.ok(sample, `no SAMPLE_PAYLOADS entry for '${key}'`);

		// Every {{var}} the template uses must be a field the emitter sends
		// (courier also injects subject/preheader into the html layout).
		const allowed = new Set([...Object.keys(sample), 'subject', 'preheader']);
		const fields = [tmpl.subject ?? '', tmpl.text, tmpl.html ?? ''];
		for (const field of fields) {
			for (const v of varsIn(field)) {
				assert.ok(allowed.has(v), `'${key}': template uses {{${v}}} but it is not in the payload`);
			}
		}

		// Rendering with the sample must leave no literal '{{' — catches
		// '{{ spaced }}' / '{{dotted.path}}' that courier's render() silently
		// passes through unsubstituted into the customer's inbox.
		for (const field of fields) {
			if (field) {
				assert.ok(!render(field, sample).includes('{{'), `'${key}': unresolved '{{' after render`);
			}
		}
	});
}

test('auth: DEFAULT_TEMPLATES is assignable to courier DefaultTemplateMap (app-wiring contract)', () => {
	// Record<string, IDefaultTemplate> is exactly courier's DefaultTemplateMap.
	// This assignment compiles iff an app can pass DEFAULT_TEMPLATES to
	// config.templates.defaults — the whole point of the mechanism.
	const map: Record<string, IDefaultTemplate> = DEFAULT_TEMPLATES;
	assert.equal(Object.keys(map).length, Object.values(MESSAGE_KEYS).length);
});

test('auth: DEFAULT_TEMPLATES and SAMPLE_PAYLOADS cover exactly the live message keys', () => {
	const keys = new Set<string>(Object.values(MESSAGE_KEYS));
	assert.deepEqual(new Set(Object.keys(DEFAULT_TEMPLATES)), keys, 'DEFAULT_TEMPLATES key set drift');
	assert.deepEqual(new Set(Object.keys(SAMPLE_PAYLOADS)), keys, 'SAMPLE_PAYLOADS key set drift');
});
