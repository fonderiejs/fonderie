#!/usr/bin/env node
// Notification-template coverage gate (notification-template normalization).
// Every module that DEFINES customer-notification message keys (`export const
// MESSAGE_KEYS`) must SHIP default templates for them — a `DEFAULT_TEMPLATES`
// map, a `SAMPLE_PAYLOADS` map for the render test, and a `templates.test.ts`
// coverage test — or be allow-listed here with a reason. This is the ecosystem
// guard: a NEW notifying module that forgets its defaults (regrowing the
// raw-JSON-dump-into-a-customer-inbox gap) fails CI. Per-key completeness and
// clean rendering are enforced inside each module (the `satisfies
// Record<XMessageKey, IDefaultTemplate>` compile constraint + templates.test.ts).
//
// Run: npm run check:template-coverage
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');

// Packages whose `MESSAGE_KEYS` are NOT customer-facing courier notifications
// (so they legitimately ship no default templates). Every entry carries its
// reason — additions are code-review decisions, not conveniences.
const ALLOW = new Map([
	// (none today — auth, workspaces, billing all emit customer notifications
	// and all ship DEFAULT_TEMPLATES.)
]);

// Recursively collect every .ts source file under a package's src/.
function tsFiles(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) out.push(...tsFiles(p));
		else if (entry.endsWith('.ts')) out.push(p);
	}
	return out;
}

const failures = [];
let checked = 0;

for (const pkg of readdirSync(packagesDir)) {
	const srcDir = join(packagesDir, pkg, 'src');
	if (!existsSync(srcDir)) continue;

	const files = tsFiles(srcDir);
	const definesKeys = files.some((f) => /export const MESSAGE_KEYS\b/.test(readFileSync(f, 'utf8')));
	if (!definesKeys) continue;

	checked++;
	if (ALLOW.has(pkg)) continue;

	const allSrc = files.map((f) => readFileSync(f, 'utf8')).join('\n');
	const missing = [];
	// DEFAULT_TEMPLATES must be exported from the package ENTRY (src/index.ts) —
	// an app imports it from the package root to wire config.templates.defaults,
	// so a declaration hidden in templates.ts without a re-export doesn't count.
	const indexSrc = readFileSync(join(srcDir, 'index.ts'), 'utf8');
	const exportsDefaults =
		/export const DEFAULT_TEMPLATES\b/.test(indexSrc) ||
		/export \{[^}]*\bDEFAULT_TEMPLATES\b[^}]*\}/.test(indexSrc);
	if (!exportsDefaults) missing.push('DEFAULT_TEMPLATES export from src/index.ts');
	// SAMPLE_PAYLOADS backs the render/coverage test (imported by the test, not
	// necessarily public — so any src file is fine).
	if (!/export const SAMPLE_PAYLOADS\b/.test(allSrc)) missing.push('SAMPLE_PAYLOADS');
	// A templates.test.ts must exist to prove the defaults render.
	if (!files.some((f) => f.endsWith('templates.test.ts'))) missing.push('templates.test.ts');

	if (missing.length) failures.push({ pkg, missing });
}

if (failures.length) {
	console.error(
		`check:template-coverage — ${failures.length} notifying module(s) define MESSAGE_KEYS but don't ship default templates:`,
	);
	for (const { pkg, missing } of failures) console.error(`  - @fonderie/${pkg}: missing ${missing.join(', ')}`);
	console.error(
		'\nEvery module that emits customer notifications must ship a DEFAULT_TEMPLATES map' +
			'\n(`satisfies Record<ItsMessageKey, IDefaultTemplate>`), a SAMPLE_PAYLOADS map, and a' +
			'\ntemplates.test.ts. Or, if its MESSAGE_KEYS are not customer emails, allow-list the' +
			'\npackage in scripts/check-template-coverage.mjs WITH a reason.',
	);
	process.exit(1);
}

console.log(
	`check:template-coverage — ${checked} notifying module(s) checked; all ship default templates + coverage test (${ALLOW.size} allow-listed).`,
);
