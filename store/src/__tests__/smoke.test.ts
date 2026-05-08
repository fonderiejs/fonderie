import { test }   from 'node:test';
import assert     from 'node:assert/strict';

import { sql }    from '../sql';

// ── sql`` helper ─────────────────────────────────────────────────

test('sql: single value produces correct placeholder', () => {
	const q = sql`SELECT * FROM users WHERE id = ${'abc'}`;
	assert.equal(q.text, 'SELECT * FROM users WHERE id = $1');
	assert.deepEqual(q.params, ['abc']);
});

test('sql: multiple values produce sequential placeholders', () => {
	const q = sql`SELECT * FROM users WHERE email = ${'a@b.com'} AND active = ${true}`;
	assert.equal(q.text, 'SELECT * FROM users WHERE email = $1 AND active = $2');
	assert.deepEqual(q.params, ['a@b.com', true]);
});

test('sql: no interpolations returns bare text with empty params', () => {
	const q = sql`SELECT 1`;
	assert.equal(q.text, 'SELECT 1');
	assert.deepEqual(q.params, []);
});

test('sql: null value is passed through as param', () => {
	const q = sql`UPDATE users SET deleted_at = ${null} WHERE id = ${'x'}`;
	assert.equal(q.text, 'UPDATE users SET deleted_at = $1 WHERE id = $2');
	assert.deepEqual(q.params, [null, 'x']);
});

test('sql: numeric zero is a valid param', () => {
	const q = sql`SELECT * FROM items WHERE quantity = ${0}`;
	assert.equal(q.text, 'SELECT * FROM items WHERE quantity = $1');
	assert.deepEqual(q.params, [0]);
});

// ── IStoreAdapter shape ───────────────────────────────────────────
// No real DB in unit tests — verify the adapter satisfies the interface
// by building a minimal in-memory stub and type-checking it.

import type { IStoreAdapter } from '../types';

test('IStoreAdapter: stub satisfies interface at compile time', () => {
	const rows: unknown[] = [];

	const stub: IStoreAdapter = {
		query: async (_sql, _params) => rows,
		transaction: async (fn) => fn(stub),
	}

	assert.ok(typeof stub.query === 'function');
	assert.ok(typeof stub.transaction === 'function');
});
