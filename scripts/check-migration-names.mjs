#!/usr/bin/env node
// Migration-filename uniqueness gate.
//
// fonderie_migrations records an applied migration by its FILENAME alone
// (`name TEXT PRIMARY KEY`), and every brick plus the app's own migrations share
// that one table. If two bricks ever ship the same filename, whichever is
// applied second sees it as "already applied" and skips it — silently, on every
// database, forever. The key cannot change without breaking deployed databases,
// so the names must stay unique across the whole repo. This gate fails the PR
// that introduces a collision.
//
// Scans every packages/*/src/**/migrations/sql/*.sql — the directories the
// bricks' getMigrationsPath() resolves to once built (tsup copies src → dist).
//
// Run: npm run check:migration-names
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');

/** Every `migrations/sql` directory under `dir`, skipping build output and deps. */
function sqlDirs(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const p = join(dir, entry);
		if (!statSync(p).isDirectory()) continue;
		if (entry === 'sql' && dir.endsWith(`${sep}migrations`)) out.push(p);
		else sqlDirs(p, out);
	}
	return out;
}

const byName = new Map(); // filename -> [relative path, ...]
const packages = new Set();
let total = 0;

for (const pkg of readdirSync(packagesDir).sort()) {
	const src = join(packagesDir, pkg, 'src');
	if (!existsSync(src)) continue;
	for (const dir of sqlDirs(src)) {
		const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
		if (files.length > 0) packages.add(pkg);
		for (const file of files) {
			total++;
			const list = byName.get(file) ?? [];
			list.push(relative(root, join(dir, file)));
			byName.set(file, list);
		}
	}
}

// A gate that scanned nothing proves nothing.
if (total === 0) {
	console.error('check:migration-names: found NO migration files under packages/*/src — the scan is broken.');
	process.exit(1);
}

const dupes = [...byName].filter(([, paths]) => paths.length > 1);
if (dupes.length > 0) {
	console.error(`check:migration-names: ${dupes.length} migration filename(s) shipped more than once:`);
	for (const [file, paths] of dupes) {
		console.error(`  ${file}`);
		for (const p of paths) console.error(`    ${p}`);
	}
	console.error(
		'\nfonderie_migrations records applied migrations by filename only, so every copy after\n' +
			'the first would be skipped as "already applied" and never run. Rename the new one\n' +
			'(e.g. prefix it with its brick).',
	);
	process.exit(1);
}

console.log(
	`check:migration-names: ${total} migration files across ${packages.size} packages, all names unique.`,
);
