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
import { randomBytes } from 'node:crypto';
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
 * Frontend SDKs and tooling are not bricks: nothing an app configures at
 * deploy time, so they ship no env.json and are neither walked nor reported.
 * One rule, shared with the check:env-declarations gate.
 */
export function isBrick(name) {
	const short = name.replace(/^@fonderie\//, '');
	return !/^(react|vue)(-|$)/.test(short) && !['client', 'cli', 'create-fonderie-app'].includes(short);
}

/**
 * The bricks an app pulls in. Follows each brick's `dependencies` and its
 * REQUIRED peers; an optional peer only when the app installs it itself —
 * otherwise every adapter (optional peers: billing, workspaces, permissions)
 * would ask a plain app for Stripe keys.
 */
export function resolveBricks(appRoot) {
	const appPkg = readJson(join(appRoot, 'package.json'));
	const direct = fonderieNames({ ...appPkg.dependencies, ...appPkg.devDependencies }).filter(isBrick);
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
		].filter(isBrick);
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

// ── Generation ───────────────────────────────────────────────────────────────


const GENERATORS = {
	'hex-32': () => randomBytes(32).toString('hex'),
	'base64-32': () => randomBytes(32).toString('base64'),
};
// What a human runs instead, printed next to each generated variable.
const GENERATE_BY_HAND = { 'hex-32': 'openssl rand -hex 32', 'base64-32': 'openssl rand -base64 32' };

const REQUIRED_LABEL = {
	always: 'required',
	production: 'required in production',
	feature: 'only with its feature',
	never: 'optional',
};

// Core and store first (every app has them), then bricks alphabetically, then the app.
function brickOrder(a, b) {
	const rank = (n) => (n === '@fonderie/core' ? 0 : n === '@fonderie/store' ? 1 : n === 'app' ? 3 : 2);
	return rank(a) - rank(b) || a.localeCompare(b);
}

const rule = (title) => `# ── ${title} ${'─'.repeat(Math.max(3, 74 - title.length))}`;

function describe(e) {
	const tags = [REQUIRED_LABEL[e.required]];
	if (e.secret) tags.push('secret');
	if (e.generate) tags.push(`generate: ${GENERATE_BY_HAND[e.generate]}`);
	const also = e.declaredBy.length > 1 ? ` Also used by ${e.declaredBy.slice(1).join(', ')}.` : '';
	const formerly = e.deprecatedNames?.length ? ` Formerly ${e.deprecatedNames.join(', ')}.` : '';
	return `# ${e.description}${also}${formerly} [${tags.join(' · ')}]`;
}

function exampleLine(e) {
	const line = `${e.name}=${e.dev ?? ''}`;
	// Empty is not unset: an optional variable with nothing to suggest stays commented.
	const commented = e.required === 'feature' || (e.required === 'never' && e.dev == null);
	return commented ? `# ${line}` : line;
}

/**
 * The full `.env.example` for a resolved set, deterministic for a given set of
 * declarations — safe to regenerate and diff in CI. Platform variables are
 * never written; feature groups are written commented out, all or none.
 */
export function renderExample(resolved) {
	const out = [
		'# GENERATED by `fonderie env generate` from the env.json of every installed',
		'# @fonderie brick, plus fonderie.env.json for the app’s own variables.',
		'# Edit those files, not this one, and re-run the command.',
		'#',
		'# `fonderie env generate` also creates or completes .env: it keeps your values,',
		'# generates the secrets marked "generate", and lists the ones only you can supply.',
		'',
	];
	const home = (e) => e.declaredBy[0];
	const written = resolved.entries.filter((e) => e.source !== 'platform');
	const bricks = [...new Set(written.map(home))].sort(brickOrder);
	for (const brick of bricks) {
		const mine = written.filter((e) => home(e) === brick);
		const plain = mine.filter((e) => e.required !== 'feature');
		const byFeature = new Map();
		for (const e of mine.filter((x) => x.required === 'feature')) {
			(byFeature.get(e.feature) ?? byFeature.set(e.feature, []).get(e.feature)).push(e);
		}
		if (plain.length) {
			out.push(rule(brick === 'app' ? 'this app (fonderie.env.json)' : brick));
			for (const e of plain) out.push(describe(e), exampleLine(e));
			out.push('');
		}
		for (const [feature, es] of byFeature) {
			const what = resolved.features[feature]?.description ?? feature;
			out.push(rule(`${what} — ${brick === 'app' ? 'this app' : brick}`));
			for (const e of es) out.push(describe(e), exampleLine(e));
			out.push('');
		}
	}
	return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

/** NAME → value for every `NAME=value` line (comments and blanks ignored). */
export function parseEnvFile(text) {
	const map = new Map();
	for (const line of (text ?? '').split('\n')) {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
		if (m) map.set(m[1], m[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
	}
	return map;
}

/**
 * Complete an existing `.env` without touching what is there. Missing
 * variables with a `generate` recipe get fresh random values; ones with a `dev`
 * value get it; a deprecated name's value is copied to the canonical name;
 * required variables nobody can invent are written empty and returned in
 * `mustSupply`. Running it again on its own output changes nothing.
 */
export function mergeDotEnv(existingText, resolved, { generate = GENERATORS } = {}) {
	const have = parseEnvFile(existingText);
	const added = [];
	const report = { generated: [], defaulted: [], renamed: [], mustSupply: [] };
	for (const e of resolved.entries) {
		if (e.source === 'platform' || have.has(e.name)) continue;
		// Before the feature skip: a set deprecated name means its feature is in
		// use — and today every deprecated name belongs to a feature (OAuth).
		const old = (e.deprecatedNames ?? []).find((n) => have.has(n) && have.get(n) !== '');
		if (old) {
			added.push(`${e.name}=${have.get(old)}`);
			report.renamed.push(`${old} → ${e.name}`);
			continue;
		}
		if (e.required === 'feature') continue;
		if (e.generate) {
			added.push(`${e.name}=${generate[e.generate]()}`);
			report.generated.push(e.name);
		} else if (e.dev != null) {
			added.push(`${e.name}=${e.dev}`);
			report.defaulted.push(e.name);
		} else if (e.required === 'always' || e.required === 'production') {
			added.push(`${e.name}=`);
			report.mustSupply.push(e.name);
		}
	}
	// Required-but-empty values already in the file still need a human.
	for (const e of resolved.entries) {
		if ((e.required === 'always' || e.required === 'production') && have.get(e.name) === '') {
			report.mustSupply.push(e.name);
		}
	}
	let text = existingText ?? '';
	if (added.length) {
		if (text && !text.endsWith('\n')) text += '\n';
		if (text) text += '\n';
		text += `# ── added by \`fonderie env generate\` ──\n${added.join('\n')}\n`;
	}
	return { text, ...report };
}
