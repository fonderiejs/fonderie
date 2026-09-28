#!/usr/bin/env node
// Env-declaration gate. Every backend brick ships an env.json declaring the
// variables it depends on (docs/ENV-DECLARATIONS-DESIGN.md); `fonderie env
// generate`, `fonderie env check` and the console's Environment page read them.
// This gate keeps each declaration true to its brick's source, both ways:
//
//   - every backend package has a valid env.json, shipped (`files`) and
//     exported (`./env.json`) — a brick with nothing to declare says `vars: []`;
//   - every `process.env.X` its src/ reads is declared `direct` or `platform`;
//   - every variable declared `direct` is actually read — otherwise it is an
//     option the app feeds, and says so;
//   - code that passes the whole `process.env` object around (unreadable by a
//     scanner) is listed in OPAQUE with the names it reads and why.
//
// Before scanning, the gate proves its scanner still catches an undeclared
// read and ignores a commented one; a scanner that sees nothing would pass
// every brick.
//
// Run: npm run check:env-declarations
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEnv, scanEnvReads, validateDeclaration } from '../packages/cli/bin/env.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');

// Frontend SDKs and tooling are not bricks an app configures at deploy time.
const NOT_A_BRICK = (name) =>
	/^(react|vue)(-|$)/.test(name) || ['client', 'cli', 'create-fonderie-app'].includes(name);

// Inlined by tsup at build time (tsup.base.ts), never read at runtime.
const BUILD_TIME = new Set(['FONDERIE_PKG_VERSION']);

// Files that hand `process.env` to code reading `env.X`. Every entry names
// exactly what that code reads, and why the object is passed whole.
const OPAQUE = new Map([
	[
		'packages/core/src/background.ts',
		{
			names: [
				'VERCEL',
				'AWS_LAMBDA_FUNCTION_NAME',
				'FUNCTION_TARGET',
				'K_SERVICE',
				'FUNCTIONS_WORKER_RUNTIME',
				'FONDERIE_BACKGROUND_TASKS',
				'FONDERIE_BACKGROUND_TIMEOUT_MS',
			],
			why: 'env is an injectable parameter defaulting to process.env, so tests can pass a fake environment',
		},
	],
	[
		'packages/admin/src/pages.ts',
		{
			names: [],
			why: 'the Environment page reports presence of the names the app lists (process.env[name]); it reads no variable of its own',
		},
	],
]);

function sourceFiles(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) {
			if (entry !== '__tests__' && entry !== 'node_modules') out.push(...sourceFiles(p));
		} else if (/\.(ts|tsx|mts|js|mjs)$/.test(entry) && !/\.(test|spec)\./.test(entry) && !entry.endsWith('.d.ts')) {
			out.push(p);
		}
	}
	return out;
}

// ── The scanner must still see ───────────────────────────────────────────────
{
	const probe = scanEnvReads(
		'// process.env.COMMENTED\nconst a = "process.env.QUOTED"; const b = process.env.CAUGHT; f(process.env);',
	);
	const seen = probe.names.map((n) => n.name);
	if (seen.join() !== 'CAUGHT' || probe.opaque.join() !== '2') {
		console.error(
			`check:env-declarations — the scanner is broken (saw [${seen}], opaque lines [${probe.opaque}]; ` +
				'expected [CAUGHT], [2]). Refusing to pass bricks it cannot read.',
		);
		process.exit(2);
	}
}

const problems = [];
let fileCount = 0;
let readCount = 0;
const usedOpaque = new Set();
const bricks = readdirSync(packagesDir)
	.filter((d) => existsSync(join(packagesDir, d, 'package.json')) && !NOT_A_BRICK(d))
	.sort();

for (const brick of bricks) {
	const dir = join(packagesDir, brick);
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const declPath = join(dir, 'env.json');
	if (!existsSync(declPath)) {
		problems.push(`${brick}: no env.json — declare its variables, or \`{ "vars": [] }\` if it reads none`);
		continue;
	}
	let decl;
	try {
		decl = JSON.parse(readFileSync(declPath, 'utf8'));
	} catch (err) {
		problems.push(`${brick}: env.json is not valid JSON (${err.message})`);
		continue;
	}
	problems.push(...validateDeclaration(decl, `${brick}/env.json`));
	if (decl.brick !== pkg.name) problems.push(`${brick}/env.json: "brick" must be "${pkg.name}"`);
	if (!(pkg.files ?? []).includes('env.json')) problems.push(`${brick}: package.json "files" must include env.json`);
	if (pkg.exports?.['./env.json'] !== './env.json') {
		problems.push(`${brick}: package.json "exports" must map "./env.json" to "./env.json"`);
	}

	const readable = new Set((decl.vars ?? []).filter((v) => v.source !== 'option').map((v) => v.name));
	const read = new Set();
	for (const file of sourceFiles(join(dir, 'src'))) {
		fileCount++;
		const rel = relative(root, file);
		const { names, opaque } = scanEnvReads(readFileSync(file, 'utf8'));
		for (const { name, line } of names) {
			if (BUILD_TIME.has(name)) continue;
			readCount++;
			read.add(name);
			if (!readable.has(name)) {
				problems.push(`${rel}:${line} reads ${name}, which ${brick}/env.json does not declare as direct or platform`);
			}
		}
		if (opaque.length) {
			const entry = OPAQUE.get(rel);
			if (!entry) {
				problems.push(
					`${rel}:${opaque.join(',')} passes process.env as a whole — read variables by name, or add the file to OPAQUE with what it reads`,
				);
				continue;
			}
			usedOpaque.add(rel);
			for (const name of entry.names) {
				read.add(name);
				if (!readable.has(name)) problems.push(`${rel} (OPAQUE) reads ${name}, which ${brick}/env.json does not declare`);
			}
		}
	}
	for (const v of decl.vars ?? []) {
		if (v.source === 'direct' && !read.has(v.name)) {
			problems.push(`${brick}/env.json declares ${v.name} as direct, but ${brick}/src never reads it — make it an option`);
		}
	}
}

let together = 'all-bricks resolution failed';
// Cross-brick consistency: an app installing every brick must resolve. Each
// declaration can be valid alone and still disagree with another about a
// shared name (DATABASE_URL in store/events/config, ADMIN_TOKEN in four).
{
	const app = mkdtempSync(join(tmpdir(), 'fonderie-env-all-'));
	const scope = join(app, 'node_modules', '@fonderie');
	mkdirSync(scope, { recursive: true });
	const deps = {};
	for (const brick of bricks) {
		const name = JSON.parse(readFileSync(join(packagesDir, brick, 'package.json'), 'utf8')).name;
		symlinkSync(join(packagesDir, brick), join(scope, name.replace('@fonderie/', '')), 'dir');
		deps[name] = '*';
	}
	writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'all-bricks', dependencies: deps }));
	try {
		const r = resolveEnv(app);
		if (r.undeclared.length) problems.push(`resolution: no env.json for ${r.undeclared.join(', ')}`);
		together = `${r.entries.length} distinct variables when all ${r.bricks.length} are installed together`;
	} catch (err) {
		problems.push(`resolution of all bricks together failed: ${err.message}`);
	} finally {
		rmSync(app, { recursive: true, force: true });
	}
}

for (const rel of OPAQUE.keys()) {
	if (!usedOpaque.has(rel)) problems.push(`OPAQUE entry ${rel} matches no whole-object read any more — remove it`);
}

console.log(
	`check:env-declarations — ${bricks.length} bricks, ${fileCount} source files, ${readCount} process.env reads, ${OPAQUE.size} opaque file(s); ${together}`,
);
if (problems.length) {
	for (const p of problems) console.error(`  ✗ ${p}`);
	process.exit(1);
}
console.log('  ✓ every brick declares what it reads, and reads what it declares direct');
