#!/usr/bin/env node
// Frontend framework-parity guard — see docs/FRONTEND-PARITY.md.
//
// The three frontend families (@fonderie/react-*, vue-*, react-native-*) are
// hand-written in parallel over the same @fonderie/client sub-clients, so they
// drift whenever a capability lands in one family only. This asserts that every
// use* hook/composable and every *Screen a react-* package exports also exists
// in its vue-* and react-native-* siblings.
//
// It catches MISSING exports (name-level parity). It does NOT catch behavioural
// drift — same name, different implementation (e.g. one sends an idempotency key
// and another doesn't). That stays a review-time concern.
//
// Exit code is non-zero if any react capability is missing from a sibling, so
// this is wireable as a `check:framework-parity` CI gate.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgs = resolve(root, 'packages');

const HOOK_FAMILIES = ['auth', 'billing', 'workspaces', 'audit', 'webhooks', 'customers', 'courier-admin', 'config-admin'];
// admin surfaces have no React Native package (dashboard-only) — expected.
const NO_RN = new Set(['courier-admin', 'config-admin']);

// Recursively read every .ts/.tsx source file of a package's src/.
function srcFiles(pkgDir) {
	const dir = join(pkgs, pkgDir, 'src');
	if (!existsSync(dir)) return null;
	const out = [];
	const walk = (d) => {
		for (const e of readdirSync(d)) {
			const p = join(d, e);
			if (statSync(p).isDirectory()) walk(p);
			else if (/\.(ts|tsx)$/.test(e)) out.push(p);
		}
	};
	walk(dir);
	return out;
}

// use* capability names a package DEFINES or names in a re-export.
function hookCaps(pkgDir) {
	const files = srcFiles(pkgDir);
	if (!files) return null;
	const set = new Set();
	for (const f of files) {
		const src = readFileSync(f, 'utf8');
		for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(use[A-Z]\w*)/g)) set.add(m[1]);
		for (const m of src.matchAll(/export\s+const\s+(use[A-Z]\w*)/g)) set.add(m[1]);
	}
	// plus names surfaced through the public index (named re-exports)
	const idx = join(pkgs, pkgDir, 'src', 'index.ts');
	if (existsSync(idx)) for (const m of readFileSync(idx, 'utf8').matchAll(/\buse[A-Z]\w*/g)) set.add(m[0]);
	return set;
}

// Public *Screen exports from index.ts, dropping I*-prefixed prop-type interfaces.
function screenCaps(pkgDir) {
	const idx = join(pkgs, pkgDir, 'src', 'index.ts');
	if (!existsSync(idx)) return null;
	const set = new Set();
	for (const m of readFileSync(idx, 'utf8').matchAll(/\b([A-Z]\w*Screen)\b/g)) {
		if (!/^I[A-Z]/.test(m[1])) set.add(m[1]);
	}
	return set;
}

function isPureReExport(pkgDir, reactSibling) {
	const files = srcFiles(pkgDir);
	if (!files) return false;
	const needle = new RegExp(`export\\s+\\*\\s+from\\s+['"]@fonderie/${reactSibling}['"]`);
	return files.some((f) => needle.test(readFileSync(f, 'utf8')));
}

const missing = (a, b) => [...a].filter((x) => !b.has(x)).sort();

let failures = 0;
const line = (s) => process.stdout.write(s + '\n');

function compare(label, reactCaps, siblingDir, capsFn, reactSibling) {
	if (!existsSync(join(pkgs, siblingDir, 'src'))) {
		line(`    ${label}: (no package)`);
		return;
	}
	if (siblingDir.startsWith('react-native-') && isPureReExport(siblingDir, reactSibling)) {
		line(`    ${label}: inherits via re-export ✓`);
		return;
	}
	const sib = capsFn(siblingDir);
	const gap = missing(reactCaps, sib);
	if (gap.length === 0) line(`    ${label}: PARITY ✓`);
	else {
		failures += gap.length;
		line(`    ${label}: MISSING ${gap.join(' ')}`);
	}
}

line('########## HOOKS / COMPOSABLES ##########');
for (const fam of HOOK_FAMILIES) {
	const react = `react-${fam}`;
	const rc = hookCaps(react);
	if (!rc) continue;
	line(`\n=== ${fam} ===`);
	line(`  react: ${[...rc].sort().join(' ')}`);
	compare('vue', rc, `vue-${fam}`, hookCaps, react);
	if (!NO_RN.has(fam)) compare('react-native', rc, `react-native-${fam}`, hookCaps, react);
}

line('\n########## SCREENS ##########');
for (const fam of HOOK_FAMILIES) {
	const react = `react-${fam}-screens`;
	const rc = screenCaps(react);
	if (!rc) continue;
	line(`\n=== ${fam}-screens ===`);
	line(`  react: ${[...rc].sort().join(' ')}`);
	compare('vue', rc, `vue-${fam}-screens`, screenCaps, react);
	if (!NO_RN.has(fam)) compare('react-native', rc, `react-native-${fam}-screens`, screenCaps, react);
}

line('');
if (failures > 0) {
	line(`✗ frontend parity: ${failures} capability(ies) missing from a sibling. See docs/FRONTEND-PARITY.md.`);
	process.exit(1);
}
line('✓ frontend parity: every react capability exists in its vue / react-native siblings.');
