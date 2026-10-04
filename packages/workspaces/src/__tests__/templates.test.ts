import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IDefaultTemplate } from '@fonderie/core';
import { translationProblems } from '@fonderie/core';

import { MESSAGE_KEYS } from '../config';
import { DEFAULT_TEMPLATES, SAMPLE_PAYLOADS } from '../templates';

// Coverage gate: every workspaces message key ships a default that renders
// cleanly with its real payload. The `satisfies Record<…>` in templates.ts
// already makes a missing key a compile error; this proves the content renders.

// Mirrors @fonderie/courier's resolver: {{var}} substitution plus {{#var}}…
// {{/var}} optional blocks. Duplicated rather than imported because workspaces
// does NOT depend on courier (same choice as billing's template test).
const VAR_RE = /\{\{(\w+)\}\}/g;
const SECTION_RE = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
// A section key IS a used variable — it must appear in the payload too.
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
	test(`workspaces default template: ${key} — exists, vars ⊆ payload, renders clean`, () => {
		const tmpl = (DEFAULT_TEMPLATES as Record<string, { subject?: string; text: string; html?: string }>)[key];
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

test('workspaces: DEFAULT_TEMPLATES is assignable to courier DefaultTemplateMap (app-wiring contract)', () => {
	const map: Record<string, IDefaultTemplate> = DEFAULT_TEMPLATES;
	assert.equal(Object.keys(map).length, Object.values(MESSAGE_KEYS).length);
});

test('workspaces: DEFAULT_TEMPLATES and SAMPLE_PAYLOADS cover exactly the live message keys', () => {
	const keys = new Set<string>(Object.values(MESSAGE_KEYS));
	assert.deepEqual(new Set(Object.keys(DEFAULT_TEMPLATES)), keys, 'DEFAULT_TEMPLATES key set drift');
	assert.deepEqual(new Set(Object.keys(SAMPLE_PAYLOADS)), keys, 'SAMPLE_PAYLOADS key set drift');
});

test('workspaces: every email ships in es, fr, zh-Hans and zh-Hant, with the same parts and variables as the English', () => {
	assert.deepEqual(translationProblems(DEFAULT_TEMPLATES), []);
	for (const [key, tmpl] of Object.entries(DEFAULT_TEMPLATES)) {
		const sample = (SAMPLE_PAYLOADS as Record<string, Record<string, unknown>>)[key] ?? {};
		for (const [lang, copy] of Object.entries(tmpl.locales ?? {})) {
			for (const field of [copy.subject ?? '', copy.text, copy.html ?? '']) {
				assert.ok(!render(field, sample).includes('{{'), `'${key}' (${lang}): unresolved '{{' after render`);
			}
		}
	}
});

// invitationUrl is optional: without it the email must still read cleanly —
// no dead link, no dangling "by" — and keep the PIN.
test('workspaces: the invitation email without a link or an inviter keeps the PIN and drops the rest', () => {
	const sample = { ...SAMPLE_PAYLOADS[MESSAGE_KEYS.workspaceInvitation], acceptUrl: '', inviterName: '' };
	const tmpl = DEFAULT_TEMPLATES[MESSAGE_KEYS.workspaceInvitation];
	for (const copy of [tmpl, ...Object.values(tmpl.locales ?? {})]) {
		for (const field of [copy.text, copy.html ?? '']) {
			const out = render(field, sample);
			assert.ok(out.includes('123456'), out);
			assert.ok(out.includes('Acme Crew'), out);
			assert.ok(!out.includes('href'), out);
			assert.ok(!/ (by|par|de parte de) \./.test(out), out);
		}
	}
	const withLink = render(tmpl.html ?? '', SAMPLE_PAYLOADS[MESSAGE_KEYS.workspaceInvitation]);
	assert.ok(withLink.includes('href="https://app.acme.example/invite/inv_abc123"'), withLink);
	assert.ok(withLink.includes('by Olivia Tester'), withLink);
});
