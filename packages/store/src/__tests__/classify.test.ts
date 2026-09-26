import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyMigration } from '../migrations/classify';

test('additive DDL is additive — a pipeline may apply it unattended', () => {
	const r = classifyMigration(`
		CREATE TABLE IF NOT EXISTS fonderie_admin_log (id UUID PRIMARY KEY);
		CREATE INDEX IF NOT EXISTS idx_admin_log_at ON fonderie_admin_log (at DESC);
		ALTER TABLE fonderie_users ADD COLUMN nickname TEXT;
	`);
	assert.equal(r.impact, 'additive');
	assert.deepEqual(r.destructive, []);
});

test('the real case: the legacy-credits drop is flagged, with the statements that earned it', () => {
	// Verbatim from a consumer's 800_drop_legacy_credits.sql — the migration
	// that must never be applied by a deploy without someone deciding to.
	const r = classifyMigration(`
		-- Retire the pre-wallet ledger.
		DROP TABLE IF EXISTS credit_grants CASCADE;
		DROP TABLE IF EXISTS credit_purchases CASCADE;
		DROP TABLE IF EXISTS credit_transactions CASCADE;
		ALTER TABLE fonderie_users DROP COLUMN IF EXISTS credits;
	`);
	assert.equal(r.impact, 'destructive');
	assert.equal(r.destructive.length, 4);
	// Reported per statement, not as the whole file: the operator needs to read
	// what is lost, not find it in four hundred lines.
	assert.ok(r.destructive.every((s) => !s.includes('\n')));
	assert.ok(r.destructive[0]?.includes('credit_grants'));
	assert.ok(r.destructive[3]?.includes('DROP COLUMN'));
});

test('TRUNCATE and a column retype count — both lose data or can fail', () => {
	assert.equal(classifyMigration('TRUNCATE fonderie_sessions;').impact, 'destructive');
	assert.equal(
		classifyMigration('ALTER TABLE t ALTER COLUMN amount TYPE bigint;').impact,
		'destructive',
	);
});

test('a DROP inside a line comment does not count — but the check errs toward flagging', () => {
	// Commented-out DDL is not DDL.
	assert.equal(classifyMigration('-- DROP TABLE users;\nCREATE TABLE t (id int);').impact, 'additive');
	// DROP INDEX / DROP CONSTRAINT lose no rows, so they stay additive.
	assert.equal(classifyMigration('DROP INDEX IF EXISTS idx_old;').impact, 'additive');
});

test('case and whitespace do not hide a drop', () => {
	for (const sql of ['drop table t;', 'DROP\n\tTABLE t;', '  Drop   Table   t ;']) {
		assert.equal(classifyMigration(sql).impact, 'destructive', sql);
	}
});
