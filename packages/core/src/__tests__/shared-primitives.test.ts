import { test } from 'node:test';
import assert from 'node:assert/strict';

import { constantTimeEqual } from '../crypto';
import { secretStrengthProblem, MIN_SECRET_LENGTH } from '../secret-strength';
import { encodeKeysetCursor, decodeKeysetCursor } from '../keyset-cursor';

test('constantTimeEqual: strings and buffers, equal only when identical', () => {
	assert.equal(constantTimeEqual('abc', 'abc'), true);
	assert.equal(constantTimeEqual('abc', 'abd'), false);
	assert.equal(constantTimeEqual('abc', 'abcd'), false, 'different lengths → false, no throw');
	assert.equal(constantTimeEqual(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 3])), true);
	assert.equal(constantTimeEqual(Buffer.from([1, 2, 3]), Buffer.from([1, 2, 4])), false);
	assert.equal(constantTimeEqual('x', Buffer.from('x')), true, 'mixed string/buffer');
});

test('secretStrengthProblem: too-short / placeholder / strong', () => {
	assert.equal(MIN_SECRET_LENGTH, 32);
	assert.equal(secretStrengthProblem('short'), 'too-short');
	assert.equal(secretStrengthProblem('changeme-changeme-changeme-changeme'), 'placeholder');
	assert.equal(secretStrengthProblem('admin-token-admin-token-admin-token'), 'placeholder', 'unified denylist includes admin-token');
	assert.equal(secretStrengthProblem('S3cure-random-secret-9f3a1c7e2b8d40x'), null, 'strong → null');
});

test('encode/decodeKeysetCursor: round-trips; range-checks; rejects junk', () => {
	const uuid = '3b241101-e2bb-4255-8caf-4136c566a962';
	const round = decodeKeysetCursor(encodeKeysetCursor('2026-09-04T00:00:00.000Z', uuid));
	assert.deepEqual(round, { createdAt: '2026-09-04T00:00:00.000Z', id: uuid });

	// Postgres text form survives (microseconds + space + offset).
	const pg = decodeKeysetCursor(encodeKeysetCursor('2026-09-04 18:50:50.888123+00', uuid));
	assert.equal(pg?.createdAt, '2026-09-04 18:50:50.888123+00');

	// The range-check that fixes audit's 500: in-shape but out-of-range → null.
	assert.equal(decodeKeysetCursor(Buffer.from(`["2026-13-40T25:61:99Z","${uuid}"]`).toString('base64url')), null);
	assert.equal(decodeKeysetCursor(Buffer.from(`["2026-01-01T00:00:00Z","not-a-uuid"]`).toString('base64url')), null);
	assert.equal(decodeKeysetCursor('not-base64-json'), null);
	assert.equal(decodeKeysetCursor('A'.repeat(300)), null, 'oversized → null');
});
