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

const reachable = (pkg, hook) => {
	for (const sub of ['src/hooks', 'src/composables']) {
		if (hookNames(join(pkgs, pkg, sub)).includes(hook)) return true;
	}
	const idx = join(pkgs, pkg, 'src/index.ts');
	return existsSync(idx) && new RegExp(`\\b${hook}\\b`).test(readFileSync(idx, 'utf8'));
};

const failures = [];
let checked = 0;

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
	console.error(`check:hook-parity — ${failures.length} hook(s) missing from a sibling package:`);
	console.error(failures.join('\n'));
	console.error(
		'\nAdd the hook to the sibling, re-export the React package wholesale, or allow-list it WITH a reason.',
	);
	process.exit(1);
}
console.log(`check:hook-parity — ${checked} sibling hook(s) checked; all reachable or allow-listed (${ALLOW.size} allowed).`);
