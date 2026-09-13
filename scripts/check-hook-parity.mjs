#!/usr/bin/env node
// Every React hook must be reachable from its React Native and Vue siblings.
//
// check:hook-coverage asks whether a hook exists ANYWHERE — it concatenates
// every hook file in the repo and greps. One package having the hook satisfies
// it. That is the right question for "can any frontend call this route" and the
// wrong one for "did we finish the job".
//
// The gap is real: useAuthProviders shipped to react-auth and vue-auth and was
// missing from react-native-auth, whose version still bumped through a
// dependency change. Current-looking, missing the API.
//
// A sibling satisfies parity two ways:
//   1. it re-exports the React package wholesale (react-native-billing et al), or
//   2. it exports a hook of the same name itself (react-native-auth, which
//      reimplements so tokens land in AsyncStorage).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgs = join(root, 'packages');

// Parity exceptions need a REASON, like every other allow-list here.
const ALLOW = new Map([
	// e.g. ['react-native-auth:useSomethingWebOnly', 'depends on window.location'],
]);

const hookNames = (dir) =>
	existsSync(dir)
		? readdirSync(dir)
				.filter((f) => /^use[A-Z].*\.ts$/.test(f))
				.map((f) => f.replace(/\.ts$/, ''))
		: [];

const exportsWholesale = (pkg, from) => {
	const idx = join(pkgs, pkg, 'src/index.ts');
	if (!existsSync(idx)) return false;
	const src = readFileSync(idx, 'utf8');
	return new RegExp(`export\\s+\\*\\s+from\\s+'@fonderie/${from}'`).test(src);
};

// PUBLICLY reachable, which is not the same as present. react-auth, vue-auth
// and react-native-auth all export from an EXPLICIT list in src/index.ts, so a
// hook can sit in src/hooks/ — imported by the barrel, bundled into the
// output — and still be absent from the package's public surface at runtime
// AND in its .d.ts. That is exactly what happened to useAuthProviders in
// react-auth and vue-auth: shipped, present in index.js, importable by nobody.
const reachable = (pkg, hook) => {
	const idx = join(pkgs, pkg, 'src/index.ts');
	if (!existsSync(idx)) return false;
	return new RegExp(`\\b${hook}\\b`).test(readFileSync(idx, 'utf8'));
};

const failures = [];
let checked = 0;

// ── Leg 0: every hook is exported from its OWN package's public entry ──
//
// The parity legs below compare packages to each other, so they never notice a
// hook that no package exports. useAuthProviders sat in react-auth/src/hooks
// and vue-auth/src/composables, was bundled into index.js, and was absent from
// both packages' runtime exports AND their .d.ts — importable by nobody, in
// every package at once. Comparing siblings cannot see that; this can.
for (const pkg of readdirSync(pkgs).filter((p) => /^(react|vue|react-native)-/.test(p) && !p.endsWith('-screens'))) {
	for (const sub of ['src/hooks', 'src/composables']) {
		for (const hook of hookNames(join(pkgs, pkg, sub))) {
			checked += 1;
			const idx = join(pkgs, pkg, 'src/index.ts');
			const exported =
				existsSync(idx) && new RegExp(`\\b${hook}\\b`).test(readFileSync(idx, 'utf8'));
			if (exported || ALLOW.has(`${pkg}:${hook}`)) continue;
			failures.push(`  - ${pkg} defines ${hook} but never exports it from src/index.ts`);
		}
	}
}

for (const pkg of readdirSync(pkgs).filter((p) => /^react-[a-z-]+$/.test(p) && !p.endsWith('-screens'))) {
	const family = pkg.replace(/^react-/, '');
	const hooks = hookNames(join(pkgs, pkg, 'src/hooks'));
	if (hooks.length === 0) continue;

	for (const sibling of [`react-native-${family}`, `vue-${family}`]) {
		if (!existsSync(join(pkgs, sibling))) continue;
		if (exportsWholesale(sibling, pkg)) continue; // inherits everything
		for (const hook of hooks) {
			checked += 1;
			if (reachable(sibling, hook)) continue;
			if (ALLOW.has(`${sibling}:${hook}`)) continue;
			failures.push(`  - ${sibling} is missing ${hook} (present in ${pkg})`);
		}
	}
}

if (failures.length > 0) {
	console.error(`check:hook-parity — ${failures.length} hook(s) not publicly reachable:`);
	console.error(failures.join('\n'));
	console.error(
		'\nExport it from the package\'s src/index.ts, add it to the sibling, re-export the React package wholesale, or allow-list it WITH a reason.',
	);
	process.exit(1);
}
console.log(`check:hook-parity — ${checked} sibling hook(s) checked; all reachable or allow-listed (${ALLOW.size} allowed).`);
