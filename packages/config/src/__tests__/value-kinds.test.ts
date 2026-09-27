import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import { ConfigTypeChangeError, configValueKind, setConfigEntry, withParsedValue } from '../services/config';

// A store holding one current row (or none); records every write's params.
function storeWith(current: { value: string } | null) {
	const writes: unknown[][] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('FROM fonderie_config WHERE key = $1 AND environment = $2')) {
				return (current ? [{ key: 'K', environment: 'all', version: 1, ...current }] : []) as T[];
			}
			if (sql.includes('FOR UPDATE')) return (current ? [{ version: 1, unchanged: false }] : []) as T[];
			if (sql.startsWith('UPDATE') || sql.startsWith('INSERT INTO fonderie_config ')) {
				writes.push(params ?? []);
				return [{ key: 'K', value: params?.[2], environment: 'all', version: 2 }] as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return { store, writes };
}

test('configValueKind distinguishes every shape a frontend can receive', () => {
	assert.equal(configValueKind('x'), 'text');
	assert.equal(configValueKind(3), 'number');
	assert.equal(configValueKind(false), 'on/off');
	assert.equal(configValueKind({ a: 1 }), 'object');
	assert.equal(configValueKind([{ id: 'm1' }, { id: 'm2' }]), 'list');
	assert.equal(configValueKind(null), 'empty');
});

test('text is stored JSON-encoded, so "42" and "true" stay text on the way back', async () => {
	for (const text of ['42', 'true', '{"a":1}', 'Hello']) {
		const { store, writes } = storeWith(null);
		await setConfigEntry({ key: 'K', value: text }, store);
		const stored = writes[0]?.[2] as string;
		assert.equal(stored, JSON.stringify(text), `stored ${text} as JSON text`);
		assert.equal(withParsedValue({ value: stored }).value, text, `${text} reads back as the same text`);
	}
});

test('objects and lists of objects round-trip', async () => {
	const merchants = [{ id: 'm1', name: 'Acme' }, { id: 'm2', name: 'Globex' }];
	const { store, writes } = storeWith(null);
	await setConfigEntry({ key: 'K', value: merchants }, store);
	assert.deepEqual(withParsedValue({ value: writes[0]?.[2] as string }).value, merchants);
});

test('changing an existing key from on/off to text is refused — every reader would get a different setting', async () => {
	const { store, writes } = storeWith({ value: 'true' });
	await assert.rejects(
		() => setConfigEntry({ key: 'K', value: 'no' }, store),
		(err: unknown) => err instanceof ConfigTypeChangeError && err.from === 'on/off' && err.to === 'text',
	);
	assert.equal(writes.length, 0, 'nothing written');
});

test('list → object is a change too; same kind saves normally', async () => {
	await assert.rejects(() => setConfigEntry({ key: 'K', value: { id: 'm1' } }, storeWith({ value: '[1,2]' }).store), ConfigTypeChangeError);
	const ok = storeWith({ value: 'true' });
	await setConfigEntry({ key: 'K', value: false }, ok.store);
	assert.equal(ok.writes.length, 1);
});

test('allowTypeChange: true changes the kind on purpose', async () => {
	const { store, writes } = storeWith({ value: 'true' });
	await setConfigEntry({ key: 'K', value: 'maybe', allowTypeChange: true }, store);
	assert.equal(writes.length, 1);
});

test('a legacy raw-text row still counts as text (no false alarm on old data)', async () => {
	const { store, writes } = storeWith({ value: 'Scheduled maintenance tonight' });
	await setConfigEntry({ key: 'K', value: 'Maintenance moved to tomorrow' }, store);
	assert.equal(writes.length, 1);
});
