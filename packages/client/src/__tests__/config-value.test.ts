import assert from 'node:assert/strict';
import { test } from 'node:test';

import { castConfigValue, configKeyProblem, configValueType, formatConfigValue } from '../index';

test('configValueType: picks the editor for a stored value', () => {
	assert.equal(configValueType('on'), 'string');
	assert.equal(configValueType(3), 'number');
	assert.equal(configValueType(false), 'boolean');
	assert.equal(configValueType({ a: 1 }), 'json');
	assert.equal(configValueType([1]), 'json');
	assert.equal(configValueType(null), 'json');
});

test('castConfigValue: string is verbatim, empty allowed', () => {
	assert.deepEqual(castConfigValue('string', '  randomValue '), { ok: true, value: '  randomValue ' });
	assert.deepEqual(castConfigValue('string', ''), { ok: true, value: '' });
});

test('castConfigValue: number accepts finite numbers only', () => {
	assert.deepEqual(castConfigValue('number', '42'), { ok: true, value: 42 });
	assert.deepEqual(castConfigValue('number', ' -2.5 '), { ok: true, value: -2.5 });
	assert.deepEqual(castConfigValue('number', '1e3'), { ok: true, value: 1000 });
	for (const bad of ['', '12px', 'NaN', 'Infinity', 'abc']) assert.equal(castConfigValue('number', bad).ok, false, bad);
});

test('castConfigValue: boolean accepts true/false, 1/0, yes/no, on/off', () => {
	for (const t of ['true', 'TRUE', '1', 'yes', 'on']) assert.deepEqual(castConfigValue('boolean', t), { ok: true, value: true }, t);
	for (const f of ['false', '0', 'No', 'off']) assert.deepEqual(castConfigValue('boolean', f), { ok: true, value: false }, f);
	assert.equal(castConfigValue('boolean', 'maybe').ok, false);
});

test('castConfigValue: json parses or explains why not', () => {
	assert.deepEqual(castConfigValue('json', '{"ids":["m1","m2"]}'), { ok: true, value: { ids: ['m1', 'm2'] } });
	const bad = castConfigValue('json', '{ids: 1}');
	assert.equal(bad.ok, false);
	assert.match((bad as { error: string }).error, /Not valid JSON/);
});

test('formatConfigValue round-trips through castConfigValue', () => {
	for (const v of ['x', 7, true, false, { a: [1, 2] }]) {
		const type = configValueType(v);
		const back = castConfigValue(type, formatConfigValue(v));
		assert.deepEqual(back, { ok: true, value: v }, JSON.stringify(v));
	}
});

test('configKeyProblem: both naming styles pass; junk is explained', () => {
	assert.equal(configKeyProblem('ENABLE_JOB_LISTING'), null);
	assert.equal(configKeyProblem('feature.dark-mode'), null);
	assert.ok(configKeyProblem(''));
	assert.ok(configKeyProblem('1st'));
	assert.ok(configKeyProblem('has space'));
});
