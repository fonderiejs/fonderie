// Environment declarations — the one place a project's variables come from.
//
// Every backend brick ships `env.json` beside its package.json, declaring the
// variables it depends on. An app may add a root `fonderie.env.json` (same
// shape) for variables it owns. resolveEnv() walks the app's @fonderie/*
// dependencies, follows their own dependencies and REQUIRED peers, and merges
// the declarations into one list — which `fonderie env generate`, `fonderie env
// check` and the admin console's Environment page all read.
//
// Design + audit: docs/ENV-DECLARATIONS-DESIGN.md. Zero dependencies.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const SOURCES = ['direct', 'option', 'platform'];
export const REQUIRED = ['always', 'production', 'feature', 'never'];
export const KINDS = ['secret32', 'hex64', 'url', 'postgres-url', 'int', 'bool', 'csv', 'pem', 'string'];
export const GENERATE = ['hex-32', 'base64-32'];

const NAME = /^[A-Z][A-Z0-9_]*$/;
const RANK = { never: 0, feature: 1, production: 2, always: 3 };

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── Validation ───────────────────────────────────────────────────────────────

/** Problems with one declaration file, as strings; [] when valid. */
export function validateDeclaration(decl, where = 'env.json') {
	const out = [];
	const bad = (m) => out.push(`${where}: ${m}`);
	if (!decl || typeof decl !== 'object') return [`${where}: not a JSON object`];
	if (!Array.isArray(decl.vars)) return [`${where}: "vars" must be an array (use [] when the brick reads nothing)`];
	const features = decl.features ?? {};
	const seen = new Set();
	for (const [i, v] of decl.vars.entries()) {
		const at = `vars[${i}]${v?.name ? ` ${v.name}` : ''}`;
		if (!v || typeof v !== 'object') { bad(`${at}: not an object`); continue; }
		if (!NAME.test(v.name ?? '')) bad(`${at}: name must be UPPER_SNAKE`);
		if (seen.has(v.name)) bad(`${at}: declared twice`);
		seen.add(v.name);
		if (!SOURCES.includes(v.source)) bad(`${at}: source must be one of ${SOURCES.join('|')}`);
		if (!REQUIRED.includes(v.required)) bad(`${at}: required must be one of ${REQUIRED.join('|')}`);
		if (typeof v.secret !== 'boolean') bad(`${at}: secret must be true or false`);
		if (!KINDS.includes(v.kind) && !/^enum:[^|]+(\|[^|]+)+$/.test(v.kind ?? '')) {
			bad(`${at}: kind must be one of ${KINDS.join('|')} or enum:a|b`);
		}
		if (v.generate != null && !GENERATE.includes(v.generate)) bad(`${at}: generate must be one of ${GENERATE.join('|')}`);
		if (v.generate && !v.secret) bad(`${at}: only secrets are generated`);
		// A generated secret is fresh per project; a fixed dev value beside it would be copied into one.
		if (v.generate && v.dev != null) bad(`${at}: "generate" and "dev" are exclusive`);
		if (typeof v.description !== 'string' || v.description.length < 8) bad(`${at}: description is required`);
		if (v.required === 'feature') {
			if (!v.feature) bad(`${at}: required "feature" needs a "feature" name`);
			else if (!features[v.feature]) bad(`${at}: feature "${v.feature}" is not described in "features"`);
		} else if (v.feature) {
			bad(`${at}: "feature" is only for required "feature"`);
		}
		if (v.source === 'platform' && (v.generate || v.dev != null)) bad(`${at}: platform variables are never written`);
		for (const alias of v.deprecatedNames ?? []) if (!NAME.test(alias)) bad(`${at}: deprecated name ${alias} must be UPPER_SNAKE`);
	}
	for (const f of Object.keys(features)) {
		if (!decl.vars.some((v) => v.feature === f)) bad(`feature "${f}" has no variables`);
	}
	return out;
}

// ── Resolution ───────────────────────────────────────────────────────────────

/** Node's lookup, reduced to what we need: the nearest node_modules/<pkg>. */
export function findPackageDir(pkg, fromDir) {
	let dir = resolve(fromDir);
	for (;;) {
		const candidate = join(dir, 'node_modules', pkg);
		if (existsSync(join(candidate, 'package.json'))) return candidate;
		const up = dirname(dir);
		if (up === dir) return null;
		dir = up;
	}
}

const fonderieNames = (obj) => Object.keys(obj ?? {}).filter((n) => n.startsWith('@fonderie/'));

/**
 * The bricks an app pulls in. Follows each brick's `dependencies` and its
 * REQUIRED peers; an optional peer only when the app installs it itself —
 * otherwise every adapter (optional peers: billing, workspaces, permissions)
 * would ask a plain app for Stripe keys.
 */
export function resolveBricks(appRoot) {
	const appPkg = readJson(join(appRoot, 'package.json'));
	const direct = fonderieNames({ ...appPkg.dependencies, ...appPkg.devDependencies });
	const installed = new Set(direct);
	const bricks = new Map(); // name → { dir, via }
	const missing = [];
	const walk = (name, via, fromDir) => {
		if (bricks.has(name)) return;
		const dir = findPackageDir(name, fromDir);
		if (!dir) { missing.push(name); return; }
		bricks.set(name, { dir, via });
		const pj = readJson(join(dir, 'package.json'));
		const optional = pj.peerDependenciesMeta ?? {};
		const next = [
			...fonderieNames(pj.dependencies),
			...fonderieNames(pj.peerDependencies).filter((n) => !optional[n]?.optional || installed.has(n)),
		];
		for (const n of next) walk(n, name, dir);
	};
	for (const d of direct) walk(d, 'app', appRoot);
	return { bricks, missing };
}

/**
 * One merged entry per variable name.
 * Throws when two declarations disagree on `kind` or `secret` for one name —
 * two bricks meaning different things by the same variable is a bug to fix,
 * not something to pick a winner for.
 */
export function resolveEnv(appRoot) {
	const { bricks, missing } = resolveBricks(appRoot);
	const undeclared = [];
	const sources = [];
	for (const [name, { dir }] of bricks) {
		const f = join(dir, 'env.json');
		if (!existsSync(f)) { undeclared.push(name); continue; }
		sources.push({ from: name, decl: readJson(f) });
	}
	const appDeclPath = join(appRoot, 'fonderie.env.json');
	if (existsSync(appDeclPath)) sources.push({ from: 'app', decl: readJson(appDeclPath) });

	const invalid = sources.flatMap(({ from, decl }) => validateDeclaration(decl, from));
	if (invalid.length) throw new Error(`invalid env declaration:\n  ${invalid.join('\n  ')}`);

	const byName = new Map();
	const features = {};
	for (const { from, decl } of sources) {
		Object.assign(features, decl.features ?? {});
		for (const v of decl.vars) {
			const cur = byName.get(v.name);
			if (!cur) {
				byName.set(v.name, { ...v, declaredBy: [from] });
				continue;
			}
			if (cur.kind !== v.kind || cur.secret !== v.secret) {
				throw new Error(
					`env conflict on ${v.name}: ${cur.declaredBy.join(', ')} ${cur.declaredBy.length > 1 ? 'declare' : 'declares'} ${cur.kind}/${cur.secret ? 'secret' : 'plain'}, ` +
						`${from} declares ${v.kind}/${v.secret ? 'secret' : 'plain'}`,
				);
			}
			cur.declaredBy.push(from);
			if (RANK[v.required] > RANK[cur.required]) {
				cur.required = v.required;
				cur.feature = v.feature;
			}
			cur.generate ??= v.generate;
			cur.dev ??= v.dev;
			cur.deprecatedNames = [...new Set([...(cur.deprecatedNames ?? []), ...(v.deprecatedNames ?? [])])];
		}
	}
	return { bricks: [...bricks.keys()], missing, undeclared, features, entries: [...byName.values()] };
}

// ── Source scanning (shared with the check:env-declarations gate) ───────────

/**
 * `process.env` reads in TypeScript/JavaScript source, comments and string
 * contents ignored. Returns `{ names, opaque }`: the literal names read
 * (`process.env.X`, `process.env['X']`) and the line numbers where the whole
 * object escapes (`= process.env`, `f(process.env)`, destructuring) so the
 * caller can require an explicit account of what that code reads.
 */
export function scanEnvReads(src) {
	const code = blankCommentsAndStrings(src);
	const names = [];
	const opaque = [];
	const re = /\bprocess\s*\.\s*env\b/g;
	for (let m = re.exec(code); m; m = re.exec(code)) {
		const line = code.slice(0, m.index).split('\n').length;
		const rest = code.slice(re.lastIndex);
		const dot = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/.exec(rest);
		if (dot) { names.push({ name: dot[1], line }); continue; }
		// Bracket access: the key is a string literal, blanked in `code` — read it from `src`.
		const br = /^\s*\[\s*(['"`])/.exec(rest);
		if (br) {
			const start = re.lastIndex + br[0].length;
			const end = src.indexOf(br[1], start);
			const key = src.slice(start, end);
			if (/^[A-Za-z_][\w]*$/.test(key)) { names.push({ name: key, line }); continue; }
		}
		opaque.push(line);
	}
	return { names, opaque };
}

/**
 * Replace comment and string-literal *contents* with spaces, keeping quotes,
 * offsets and newlines, so a regex over the result sees only code. Template
 * literal `${…}` expressions stay code. Regex literals are rare in bricks and a
 * `/` there is treated as division — acceptable for this scanner's purpose.
 */
export function blankCommentsAndStrings(src) {
	const out = src.split('');
	const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
	let i = 0;
	const tplDepth = []; // brace depth at which each open template's ${ started
	let braces = 0;
	while (i < src.length) {
		const c = src[i];
		const n = src[i + 1];
		if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; blank(i, end); i = end; continue; }
		if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; blank(i, end); i = end; continue; }
		if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
			blank(i + 1, j); i = j + 1; continue;
		}
		if (c === '`' || (c === '}' && tplDepth.length && tplDepth[tplDepth.length - 1] === braces)) {
			if (c === '}') tplDepth.pop();
			let j = i + 1;
			while (j < src.length && src[j] !== '`' && !(src[j] === '$' && src[j + 1] === '{')) j += src[j] === '\\' ? 2 : 1;
			blank(i + 1, j);
			if (src[j] === '$') { tplDepth.push(braces); i = j + 2; continue; }
			i = j + 1; continue;
		}
		if (c === '{') braces++;
		else if (c === '}') braces--;
		i++;
	}
	return out.join('');
}
