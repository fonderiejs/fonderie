import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RegionRegistry, regions } from '../region';

test('country names in any language normalize to their code; unknown ones pass through', () => {
	for (const v of ['Canada', 'can', 'ca', ' CA ']) assert.equal(regions.normalizeCountry(v), 'CA');
	for (const v of ['USA', 'United States', 'us', 'États-Unis', 'Estados Unidos', '美国']) assert.equal(regions.normalizeCountry(v), 'US');
	assert.equal(regions.normalizeCountry('fr'), 'FR');
	assert.equal(regions.normalizeCountry('Deutschland'), 'Deutschland');
	assert.equal(regions.normalizeCountry(''), null);
});

test('a Canadian address: province by code or by its English or French name, postal code formatted', () => {
	assert.deepEqual(regions.checkAddress({ country: 'Canada', subdivision: 'Québec', postalCode: 'h2x1y4' }), {
		country: 'CA', subdivision: 'QC', postalCode: 'H2X 1Y4', problems: [],
	});
	assert.equal(regions.checkAddress({ country: 'CA', subdivision: 'CA-on' }).subdivision, 'ON');
	for (const [name, code] of [['Colombie-Britannique', 'BC'], ['Nouvelle-Écosse', 'NS'], ['Île-du-Prince-Édouard', 'PE'], ['QUEBEC', 'QC']] as const) {
		assert.equal(regions.checkAddress({ country: 'Canada', subdivision: name }).subdivision, code, name);
	}
	const bad = regions.checkAddress({ country: 'CA', subdivision: 'NY', postalCode: 'D2X 1Y4' });
	assert.deepEqual(bad.problems.map((p) => p.field), ['subdivision', 'postalCode']);
});

test('a US address: state, ZIP and ZIP+4', () => {
	const ok = regions.checkAddress({ country: 'US', subdivision: 'new york', postalCode: '10001-1234' });
	assert.deepEqual(ok, { country: 'US', subdivision: 'NY', postalCode: '10001-1234', problems: [] });
	assert.equal(regions.checkAddress({ country: 'US', subdivision: 'Puerto Rico' }).subdivision, 'PR');
	assert.deepEqual(regions.checkAddress({ country: 'US', subdivision: 'QC', postalCode: 'H2X 1Y4' }).problems.map((p) => p.field), ['subdivision', 'postalCode']);
});

test('a country without a pack is stored as given, never judged by another country\'s rules', () => {
	assert.deepEqual(regions.checkAddress({ country: 'MX', subdivision: 'Jalisco', postalCode: '44100' }).problems, []);
	assert.deepEqual(regions.checkTaxRegistration({ country: 'MX', type: 'RFC', number: 'XAXX010101000' }), {
		value: { country: 'MX', type: 'RFC', number: 'XAXX010101000', region: null, label: null },
	});
});

test('an app adds a country by registering data — no Fonderie change', () => {
	const r = new RegionRegistry().register({
		code: 'MX',
		names: ['México', 'Mexico'],
		subdivisions: { JAL: { name: 'Jalisco' }, CMX: { name: 'Ciudad de México', aliases: ['CDMX'] } },
		subdivisionLabel: 'estado',
		postalCode: { pattern: /^\d{5}$/, example: '44100', label: 'código postal' },
		taxIds: { RFC: { label: 'RFC', pattern: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/, example: 'XAXX010101000' } },
	});
	assert.deepEqual(r.checkAddress({ country: 'México', subdivision: 'cdmx', postalCode: '06600' }), {
		country: 'MX', subdivision: 'CMX', postalCode: '06600', problems: [],
	});
	assert.deepEqual(r.checkAddress({ country: 'MX', postalCode: '6600' }).problems.map((p) => p.field), ['postalCode']);
	assert.ok('value' in r.checkTaxRegistration({ country: 'MX', type: 'RFC', number: 'xaxx010101000' }));
	assert.ok('problem' in r.checkTaxRegistration({ country: 'MX', type: 'RFC', number: '123' }));
	assert.ok('problem' in r.checkTaxRegistration({ country: 'MX', type: 'GST_HST', number: '123456789RT0001' }), 'Canada\'s types are not Mexico\'s');
});

test('Canadian tax numbers: GST/HST, QST (always Quebec), PST (BC/SK/MB only)', () => {
	assert.deepEqual(regions.checkTaxRegistration({ country: 'CA', type: 'GST_HST', number: '123 456 789 rt 0001', label: 'TPS/TVH' }), {
		value: { country: 'CA', type: 'GST_HST', number: '123456789RT0001', region: null, label: 'TPS/TVH' },
	});
	assert.deepEqual(regions.checkTaxRegistration({ country: 'Canada', type: 'QST', number: '1234567890TQ0001' }), {
		value: { country: 'CA', type: 'QST', number: '1234567890TQ0001', region: 'CA-QC', label: null },
	});
	assert.ok('problem' in regions.checkTaxRegistration({ country: 'CA', type: 'GST_HST', number: '123456789' }));
	assert.ok('value' in regions.checkTaxRegistration({ country: 'CA', type: 'PST', number: 'PST-1234-5678', region: 'ca-bc' }));
	assert.ok('problem' in regions.checkTaxRegistration({ country: 'CA', type: 'PST', number: '1', region: 'ON' }), 'Ontario has HST, not PST');
	assert.ok('problem' in regions.checkTaxRegistration({ country: 'CA', type: 'EIN', number: '123456789' }), 'EIN is American');
});

test('US tax numbers: EIN formatted, a state permit needs a real state', () => {
	assert.deepEqual(regions.checkTaxRegistration({ country: 'US', type: 'EIN', number: '123456789' }), {
		value: { country: 'US', type: 'EIN', number: '12-3456789', region: null, label: null },
	});
	assert.ok('problem' in regions.checkTaxRegistration({ country: 'US', type: 'EIN', number: '12-345' }));
	assert.deepEqual(regions.checkTaxRegistration({ country: 'US', type: 'STATE_SALES_TAX', number: '12-345678', region: 'US-NY' }), {
		value: { country: 'US', type: 'STATE_SALES_TAX', number: '12-345678', region: 'US-NY', label: null }, // kept as typed: every state has its own format
	});
	assert.ok('problem' in regions.checkTaxRegistration({ country: 'US', type: 'STATE_SALES_TAX', number: '1', region: 'US-ZZ' }));
});
