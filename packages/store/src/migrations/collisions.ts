import { readdirSync } from 'node:fs';

import type { IStoreAdapter } from '../types';
import { InternalMigrationRunner } from './runner';

/** A directory of migrations, optionally labelled: `dir` or `[name, dir]`. */
export type MigrationSetInput = string | readonly [name: string, dir: string];

/**
 * Refuse a set of migration directories in which two ship the same filename.
 *
 * fonderie_migrations records an applied migration by its FILENAME alone —
 * `name TEXT PRIMARY KEY`, shared by every brick and the app's own domain
 * migrations. So when two directories both contain `001_init.sql`, whichever
 * runs second sees it "already applied" and skips it, silently and forever:
 * its tables are never created, and nothing anywhere says so. The key cannot
 * change without breaking every deployed database, so the collision has to be
 * caught before anything is applied — here, where every directory of the run
 * is visible at once.
 *
 * Throws naming the file and both directories. Directories that do not exist
 * are skipped (the runner reports those itself).
 */
export function assertUniqueMigrationNames(sets: ReadonlyArray<MigrationSetInput>): void {
	const seen = new Map<string, string>(); // filename -> label of the first dir
	const clashes: string[] = [];
	for (const set of sets) {
		const [label, dir] = typeof set === 'string' ? [set, set] : [`${set[0]} (${set[1]})`, set[1]];
		let files: string[];
		try {
			files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
		} catch {
			continue;
		}
		for (const file of files) {
			const first = seen.get(file);
			if (first === undefined) seen.set(file, label);
			else if (first !== label) clashes.push(`"${file}" is in both ${first} and ${label}`);
		}
	}
	if (clashes.length === 0) return;
	throw new Error(
		`[store] migration filename collision: ${clashes.join('; ')}. ` +
			`fonderie_migrations records applied migrations by filename only, so the second ` +
			`one would be skipped as "already applied" and never run. Rename one of them ` +
			`(e.g. prefix it with its module). Refusing to run.`,
	);
}

/**
 * Apply several migration directories in the given order, after refusing any
 * filename collision between them. The order is the caller's — bricks first,
 * then the app's own migrations that extend their tables.
 */
export async function runMigrationSets(
	store: IStoreAdapter,
	sets: ReadonlyArray<MigrationSetInput>,
): Promise<void> {
	assertUniqueMigrationNames(sets);
	for (const set of sets) {
		await new InternalMigrationRunner(store, typeof set === 'string' ? set : set[1]).run();
	}
}
