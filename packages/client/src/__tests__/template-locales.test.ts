import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type ITemplateEntry, groupTemplatesByType, missingTemplateLocales } from '../index';

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
