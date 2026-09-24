import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IRequestSchema } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';
import { classifyMigration, InternalMigrationRunner } from '@fonderie/store';

import type { IAdminMigrationModule, IAdminMigrationsReport, IMigrationSet } from './types';

/**
 * `expect` is the exact pending list the operator was shown, in order.
 *
 * It is not ceremony. Between rendering the page and clicking the button a
 * deploy can change what is pending — and the thing that changed is precisely
 * the thing nobody reviewed. Sending it back makes the server refuse rather
 * than apply a set the operator never saw. Same shape as versionedWrite's
 * if_version, and it also gives this POST the body schema audit:validation
 * requires.
 */
export const applyMigrationsSchema: IRequestSchema = {
	safeParse(input: unknown) {
		const fail = (path: string, message: string) => ({
			success: false as const,
			error: { issues: [{ path: [path], message }] },
		});
		const b = (input ?? {}) as Record<string, unknown>;
		const expect = b['expect'];
		if (!Array.isArray(expect) || !expect.every((f) => typeof f === 'string'))
			return fail('expect', 'expect must be the list of pending filenames you were shown');
		// An empty list is legitimate: it asserts "I was told there was nothing
		// to do", and the handler answers UP_TO_DATE or CHANGED accordingly.
		return { success: true as const, data: { expect: expect as string[] } };
	},
};

// Applying is the APP's order, never ours. The sets arrive already interleaved
// — brick dirs and the app's own, in the sequence its applier runs them — from
// the one constant both the applier and this reporter read. See LeadEasyGen's
// db/migrations/steps.ts: "auth owns fonderie_users, which the app migration
// extends, and media's assets reference storage's blobs."

// Has this database EVER been migrated? pending() cannot answer it: it catches
// its own read failure and returns every file, so a virgin database, a database
// belonging to another app, and an unreachable one are the same answer. Asked
// directly, because "61 pending" means something completely different depending
// on which of those it is.
async function hasMigrationHistory(store: IStoreAdapter): Promise<boolean> {
	try {
		const rows = await store.query<{ n: number }>(
			'SELECT count(*)::int AS n FROM fonderie_migrations',
		);
		return (rows[0]?.n ?? 0) > 0;
	} catch {
		return false;
	}
}

function classifyPending(dir: string, files: readonly string[]) {
	return files.map((file) => {
		const { impact, destructive } = classifyMigration(readFileSync(join(dir, file), 'utf8'));
		return { file, impact, destructive };
	});
}

/**
 * What every module is waiting on, with each pending file's impact.
 *
 * `blockedBy` names the first EARLIER module that is behind. Order is
 * load-bearing and declared by the app, so a module cannot be applied while
 * something it may depend on is unapplied — the panel offers one button at a
 * time and the operator walks the list in the declared order.
 */
export async function migrationsReport(
	store: IStoreAdapter,
	sets: ReadonlyArray<IMigrationSet>,
): Promise<IAdminMigrationsReport> {
	const everApplied = await hasMigrationHistory(store);

	const modules: IAdminMigrationModule[] = [];
	let firstBehind: string | null = null;

	for (const [name, dir] of sets) {
		const pending = await new InternalMigrationRunner(store, dir).pending();
		const files = classifyPending(dir, pending);
		modules.push({
			name,
			pending: files,
			// Only a module BEFORE this one blocks it. The first module with
			// pending work blocks every module after it, and nothing blocks it.
			blockedBy: firstBehind,
			// A file that deletes data on a database with nothing in it yet is not
			// destroying anything. Same rule the CLI's --check applies.
			appliable: files.length > 0 && firstBehind === null && (!everApplied || files.every((f) => f.impact === 'additive')),
		});
		if (files.length > 0 && firstBehind === null) firstBehind = name;
	}

	return { everApplied, modules };
}

export type ApplyOutcome =
	| { ok: true; reason: 'MIGRATIONS_APPLIED' | 'MIGRATIONS_UP_TO_DATE'; module: IAdminMigrationModule }
	| { ok: false; reason: 'NOT_FOUND' }
	| { ok: false; reason: 'MIGRATIONS_OUT_OF_ORDER'; blockedBy: string }
	| { ok: false; reason: 'MIGRATIONS_CHANGED'; expected: string[]; actual: string[] }
	| { ok: false; reason: 'MIGRATION_DESTRUCTIVE'; files: IAdminMigrationModule['pending'] };

/**
 * Apply one module's pending migrations — all of them, or none.
 *
 * There is no partial apply, deliberately: files run in lexicographic order, so
 * an additive migration sorting AFTER a destructive one may depend on it.
 * Cherry-picking around a DROP would apply 901 against a schema that never saw
 * 900. Refusing the whole module at the first destructive file is the only safe
 * reading, and happens to be the only one MigrationRunner.run() supports.
 *
 * `expect` is the file list the operator was looking at. Between the render and
 * the click a deploy can change what is pending; without this the button would
 * apply something nobody reviewed.
 */
export async function applyModuleMigrations(
	store: IStoreAdapter,
	sets: ReadonlyArray<IMigrationSet>,
	module: string,
	expect: readonly string[],
): Promise<ApplyOutcome> {
	const set = sets.find(([name]) => name === module);
	if (!set) return { ok: false, reason: 'NOT_FOUND' };

	// Recomputed here rather than trusted from a previous call: this is the
	// check that decides whether to write.
	const before = await migrationsReport(store, sets);
	const target = before.modules.find((m) => m.name === module);
	if (!target) return { ok: false, reason: 'NOT_FOUND' };

	if (target.blockedBy) {
		return { ok: false, reason: 'MIGRATIONS_OUT_OF_ORDER', blockedBy: target.blockedBy };
	}

	const actual = target.pending.map((p) => p.file);
	const same = actual.length === expect.length && actual.every((f, i) => f === expect[i]);
	if (!same) {
		return { ok: false, reason: 'MIGRATIONS_CHANGED', expected: [...expect], actual };
	}

	if (actual.length === 0) {
		return { ok: true, reason: 'MIGRATIONS_UP_TO_DATE', module: target };
	}

	const destructive = target.pending.filter((p) => p.impact === 'destructive');
	if (destructive.length > 0 && before.everApplied) {
		return { ok: false, reason: 'MIGRATION_DESTRUCTIVE', files: destructive };
	}

	await new InternalMigrationRunner(store, set[1]).run();

	// Re-READ, never assume. run() returns void, and a request that dies
	// mid-apply still committed every file it finished — each one is its own
	// transaction. What the database says now is the only honest answer.
	const after = await migrationsReport(store, sets);
	const now = after.modules.find((m) => m.name === module);
	return {
		ok: true,
		reason: 'MIGRATIONS_APPLIED',
		module: now ?? { name: module, pending: [], blockedBy: null, appliable: false },
	};
}
