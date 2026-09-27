import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieApp, canonicalLocale, defineLocales, localeChain } from '../index';

test('canonicalLocale: case-insensitive, null for non-tags', () => {
	assert.equal(canonicalLocale('EN-us'), 'en-US');
	assert.equal(canonicalLocale('fr'), 'fr');
	assert.equal(canonicalLocale('zh-hant-tw'), 'zh-Hant-TW');
	assert.equal(canonicalLocale('not a locale'), null);
	assert.equal(canonicalLocale(''), null);
	assert.equal(canonicalLocale(undefined), null);
});

test('defineLocales: defaults to en-US with no chains', () => {
	const s = defineLocales();
	assert.equal(s.default, 'en-US');
	assert.deepEqual(s.fallbacks, {});
});

test('defineLocales: canonicalizes keys and chains', () => {
	const s = defineLocales({ default: 'en-ca', fallbacks: { FR: 'fr-ca', 'fr-be': ['FR-fr', 'fr-CA'] } });
	assert.equal(s.default, 'en-CA');
	assert.deepEqual(s.fallbacks, { fr: ['fr-CA'], 'fr-BE': ['fr-FR', 'fr-CA'] });
	assert.ok(Object.isFrozen(s) && Object.isFrozen(s.fallbacks));
});

test('defineLocales: refuses bad chains, naming the entry', () => {
	assert.throws(() => defineLocales({ default: 'nope nope' }), /locales\.default/);
	assert.throws(() => defineLocales({ fallbacks: { 'x y': 'fr' } }), /"x y" is not a valid/);
	assert.throws(() => defineLocales({ fallbacks: { fr: 'bad tag' } }), /\["fr"\]: "bad tag"/);
	assert.throws(() => defineLocales({ fallbacks: { 'fr-CA': 'fr-ca' } }), /falls back to itself/);
	assert.throws(() => defineLocales({ fallbacks: { fr: ['fr-CA', 'FR-ca'] } }), /listed twice/);
	assert.throws(() => defineLocales({ fallbacks: { fr: [] } }), /empty list/);
	assert.throws(
		() => defineLocales({ fallbacks: { fr: ['fr-BE', 'fr-CA', 'fr-CH', 'fr-LU', 'fr-MC', 'fr-SN'] } }),
		/6 fallbacks, at most 5/,
	);
	assert.throws(() => defineLocales({ fallbacks: { fr: 'fr-CA', FR: 'fr-BE' } }), /declared twice/);
});

test('localeChain: exact, then the declared chain; the system locale is never in it', () => {
	const s = defineLocales({
		default: 'en-US',
		fallbacks: { fr: 'fr-CA', 'fr-BE': ['fr-FR', 'fr-CA'], es: ['es-MX', 'en-US'] },
	});
	assert.deepEqual(localeChain('fr-FR', s), ['fr-FR', 'fr-CA']); // language chain
	assert.deepEqual(localeChain('fr-BE', s), ['fr-BE', 'fr-FR', 'fr-CA']); // market wins over language
	assert.deepEqual(localeChain('fr-CA', s), ['fr-CA']); // its own language chain points at itself
	assert.deepEqual(localeChain('es-AR', s), ['es-AR', 'es-MX']); // en-US is the system locale: dropped
	assert.deepEqual(localeChain('en-ZH', s), ['en-ZH']); // unsupported: straight to the system locale
	assert.deepEqual(localeChain('en-us', s), []); // the system locale itself
	assert.deepEqual(localeChain(null, s), []);
	assert.deepEqual(localeChain('garbage tag', s), []);
});

test('localeChain: chains do not expand', () => {
	const s = defineLocales({ fallbacks: { 'fr-BE': 'fr-FR', 'fr-FR': 'fr-CA' } });
	assert.deepEqual(localeChain('fr-BE', s), ['fr-BE', 'fr-FR']);
});

test('FonderieApp: exposes validated locales, and a bad chain stops construction', () => {
	const db = { url: 'postgres://localhost/x' };
	assert.equal(new FonderieApp({ db }).locales.default, 'en-US');
	assert.equal(new FonderieApp({ db, locales: { default: 'fr-ca' } }).locales.default, 'fr-CA');
	assert.throws(() => new FonderieApp({ db, locales: { fallbacks: { fr: 'fr' } } }), /falls back to itself/);
});

test('translationProblems: missing language, missing part, and a dropped variable are all caught', async () => {
	const { translationProblems } = await import('../index');
	const ok = {
		reset: {
			subject: 'Reset',
			text: 'Code {{pin}}',
			html: '<p>{{pin}}</p>{{#link}}<a>go</a>{{/link}}',
			locales: {
				fr: { subject: 'Réinitialiser', text: 'Code {{pin}}', html: '<p>{{pin}}</p>{{#link}}<a>aller</a>{{/link}}' },
				es: { subject: 'Restablecer', text: 'Código {{pin}}', html: '<p>{{pin}}</p>{{#link}}<a>ir</a>{{/link}}' },
			},
		},
	};
	assert.deepEqual(translationProblems(ok), []);
	const bad = {
		reset: {
			subject: 'Reset',
			text: 'Code {{pin}}',
			html: '<p>{{pin}}</p>',
			locales: { fr: { subject: 'Réinitialiser', text: 'Code' } },
		},
	};
	assert.deepEqual(translationProblems(bad), [
		'reset: no es copy',
		'reset (fr): html differs in presence',
		'reset (fr): text variables [] ≠ English [pin]',
		'reset (fr): html variables [] ≠ English [pin]',
	]);
});
