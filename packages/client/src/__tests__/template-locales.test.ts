import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	type ITemplateEntry,
	groupTemplatesByType,
	missingTemplateLocales,
	suggestTemplateLocales,
	templateLanguages,
} from '../index';

const row = (type: string, locale: string | null, extra: Partial<ITemplateEntry> = {}): ITemplateEntry => ({
	type,
	locale,
	subject: null,
	html: null,
	text: 'x',
	active: true,
	version: 1,
	updatedBy: null,
	updatedAt: '2026-01-01T00:00:00.000Z',
	...extra,
});

test('groupTemplatesByType: one group per type, in server order, default locale first', () => {
	const groups = groupTemplatesByType([
		row('welcome', 'fr'),
		row('receipt', null),
		row('welcome', null, { system: true }),
		row('welcome', 'es'),
	]);
	assert.deepEqual(
		groups.map((g) => [g.type, g.entries.map((e) => e.locale)]),
		[
			['welcome', [null, 'es', 'fr']],
			['receipt', [null]],
		],
	);
	assert.equal(groups[0]?.primary.locale, null);
	assert.equal(groups[0]?.system, true);
	assert.equal(groups[1]?.system, false);
});

test('groupTemplatesByType: a type with no default opens its first locale', () => {
	const [group] = groupTemplatesByType([row('digest', 'fr'), row('digest', 'de')]);
	assert.equal(group?.primary.locale, 'de');
});

test('missingTemplateLocales: locales used elsewhere, not yet on this type', () => {
	const rows = [row('welcome', null), row('welcome', 'fr'), row('receipt', 'es'), row('receipt', 'fr'), row('reset', 'de')];
	assert.deepEqual(missingTemplateLocales(rows, 'welcome'), ['de', 'es']);
	assert.deepEqual(missingTemplateLocales(rows, 'reset'), ['es', 'fr']);
	assert.deepEqual(missingTemplateLocales([row('welcome', null)], 'welcome'), []);
});

// ── catalog helpers ──────────────────────────────────────────────────────

const v = (locale: string | null, active = true) => ({ locale, active, version: 1, updatedAt: '2026-01-01' });

test('templateLanguages: saved and built-in merged, sorted by label, the default shown as the system locale', () => {
	const email = {
		type: 'password-reset',
		system: true,
		builtIn: { default: true, languages: ['es', 'fr'] },
		versions: [v(null), v('fr'), v('fr-CA', false)],
	};
	assert.deepEqual(
		templateLanguages(email, 'en-US').map((l) => [l.label, l.locale, l.saved, l.builtIn, l.active]),
		[
			['en-US', null, true, true, true],
			['es', 'es', false, true, true], // built-in only
			['fr', 'fr', true, true, true], // saved over the built-in: one entry
			['fr-CA', 'fr-CA', true, false, false], // the app's own, switched off
		],
	);
});

test('templateLanguages: a built-in email nobody saved, and an app email with no default', () => {
	const builtInOnly = { type: 'payment-failed', system: true, builtIn: { default: true, languages: ['es', 'fr'] }, versions: [] };
	assert.deepEqual(templateLanguages(builtInOnly, 'en-CA').map((l) => `${l.label}:${l.saved}`), ['en-CA:false', 'es:false', 'fr:false']);
	const appOnly = { type: 'weekly-digest', system: false, builtIn: { default: false, languages: [] }, versions: [v('fr')] };
	assert.deepEqual(templateLanguages(appOnly, 'en-US').map((l) => l.label), ['fr']);
});

test('suggestTemplateLocales: used elsewhere, missing here, never the system locale', () => {
	const catalog = {
		defaultLocale: 'en-US',
		fallbacks: {},
		emails: [
			{ type: 'password-reset', system: true, builtIn: { default: true, languages: ['es', 'fr'] }, versions: [v(null), v('fr-CA')] },
			{ type: 'weekly-digest', system: false, builtIn: { default: false, languages: [] }, versions: [v('fr')] },
		],
	};
	assert.deepEqual(suggestTemplateLocales(catalog, 'weekly-digest'), ['es', 'fr-CA']);
	assert.deepEqual(suggestTemplateLocales(catalog, 'password-reset'), []);
});
