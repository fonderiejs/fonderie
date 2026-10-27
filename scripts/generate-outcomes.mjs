#!/usr/bin/env node
// Generates .claude/skills/fonderie/signatures/<pkg>-outcomes.md — what each
// package DOES to a running app: the database tables its migrations create,
// the rows it seeds, and the HTTP routes it registers (with their middleware
// chain, so auth/validation requirements are visible).
//
// Motivation (experiments/multi-module-2026-07/DIAGNOSIS.md): agents wiring
// Fonderie spent 30–40% of their tool calls excavating exactly these facts
// from dist bundles and tarballs. Signatures cover how to CALL a package;
// this file covers what EXISTS after you do.
//
// Run via `npm run docs:signatures` (which chains this script). Same
// freshness contract: CI can enforce with `git diff --exit-code`.
//
// Route paths may be string literals ('/x'), plain templates (`/x`), or
// templates with holes (`${base}/stream` — sse's form). Holes render as
// {base} so the brain records the static tail an agent needs. A registration
// call whose path is none of those THROWS rather than skipping silently: an
// unreadable route is a brain under-count nobody notices (sse reported zero
// routes for months before the 2026-10 audit caught it). The error names the
// file and line and offers the two fixes — make the path statically
// extractable, or extend routePathText() below for the new form.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { writeFragment } from './brain-fragment.mjs';
import { SCOPE_PREFIX } from './scope.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgsDir = join(root, 'packages');

// Every @fonderie/* library with a src/index.ts — same filter as
// generate-brain.mjs and generate-signatures.mjs. Packages with no tables
// and no routes (e.g. frontend hook/screen packages) are skipped further
// down once their outcomes turn out empty — see the `continue` below.
function discoverPackages() {
	return readdirSync(pkgsDir)
		.filter((p) => {
			const pj = join(pkgsDir, p, 'package.json');
			if (!existsSync(pj)) return false;
			const j = JSON.parse(readFileSync(pj, 'utf8'));
			return j.name?.startsWith(SCOPE_PREFIX) && !j.bin && existsSync(join(pkgsDir, p, 'src/index.ts'));
		})
		.sort();
}

const PACKAGES = discoverPackages();

// ── Schema: replay migrations/sql/*.sql textually ──────────────────────────
// Handles the dialect subset our migrations actually use: CREATE TABLE,
// ALTER TABLE ADD/DROP/RENAME COLUMN, DROP TABLE, plus INSERT seeds (kept
// verbatim — seeded roles/templates are behavioral contract, not trivia).

function splitTopLevel(body) {
	const parts = [];
	let depth = 0, cur = '';
	for (const ch of body) {
		if (ch === '(') depth++;
		if (ch === ')') depth--;
		if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
		else cur += ch;
	}
	if (cur.trim()) parts.push(cur.trim());
	return parts;
}

function replayMigrations(sqlDir) {
	const tables = new Map(); // name -> { columns: Map<name, def>, constraints: [] }
	const seeds = [];
	const unhandled = [];
	const files = readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();

	for (const file of files) {
		const sql = readFileSync(join(sqlDir, file), 'utf8')
			.replace(/--[^\n]*/g, '');
		// Statement split on semicolons outside parens/quotes (our files are simple).
		for (const raw of sql.split(/;\s*(?=\n|$)/)) {
			const stmt = raw.trim();
			if (!stmt) continue;
			let m;
			if ((m = stmt.match(/^CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*)\)\s*$/i))) {
				const [, name, body] = m;
				const t = { columns: new Map(), constraints: [] };
				for (const part of splitTopLevel(body)) {
					const line = part.replace(/\s+/g, ' ').trim();
					if (/^(PRIMARY KEY|UNIQUE|CONSTRAINT|FOREIGN KEY|CHECK)\b/i.test(line)) t.constraints.push(line);
					else {
						const col = line.match(/^"?(\w+)"?\s+([\s\S]+)$/);
						if (col) t.columns.set(col[1], col[2]);
					}
				}
				tables.set(name, t);
			} else if ((m = stmt.match(/^ALTER TABLE (?:IF EXISTS )?(\w+)\s+([\s\S]+)$/i))) {
				const [, name, rest] = m;
				const t = tables.get(name);
				if (!t) { unhandled.push(stmt.split('\n')[0]); continue; }
				for (const action of splitTopLevel(rest)) {
					let am;
					if ((am = action.match(/^ADD (?:COLUMN )?(?:IF NOT EXISTS )?"?(\w+)"?\s+([\s\S]+)$/i))) t.columns.set(am[1], am[2].replace(/\s+/g, ' '));
					else if ((am = action.match(/^DROP (?:COLUMN )?(?:IF EXISTS )?"?(\w+)"?/i))) t.columns.delete(am[1]);
					else if ((am = action.match(/^RENAME (?:COLUMN )?"?(\w+)"?\s+TO\s+"?(\w+)"?/i))) {
						const def = t.columns.get(am[1]);
						if (def) { t.columns.delete(am[1]); t.columns.set(am[2], def); }
					} else if ((am = action.match(/^ADD (CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b([\s\S]*)$/i))) t.constraints.push(action.replace(/\s+/g, ' '));
					else if ((am = action.match(/^ALTER (?:COLUMN )?"?(\w+)"?\s+(SET|DROP)\s+NOT NULL/i))) {
						const def = t.columns.get(am[1]);
						if (def) t.columns.set(am[1], am[2].toUpperCase() === 'SET'
							? (def.includes('NOT NULL') ? def : `${def} NOT NULL`)
							: def.replace(/\s*NOT NULL/i, ''));
					}
					else unhandled.push(`${name}: ${action.split('\n')[0]}`);
				}
			} else if ((m = stmt.match(/^DROP TABLE (?:IF EXISTS )?(\w+)/i))) {
				tables.delete(m[1]);
			} else if (/^INSERT INTO/i.test(stmt)) {
				seeds.push(stmt.replace(/\s+/g, ' ').trim());
			} else if (/^CREATE (UNIQUE )?INDEX/i.test(stmt)) {
				const im = stmt.match(/^CREATE (UNIQUE )?INDEX (?:IF NOT EXISTS )?(\w+) ON (\w+)\s*(\([^)]*\))/i);
				if (im) tables.get(im[3])?.constraints.push(`${im[1] ? 'UNIQUE ' : ''}INDEX ${im[2]} ${im[4]}`);
			} else if ((m = stmt.match(/^DROP INDEX (?:IF EXISTS )?"?(\w+)"?/i))) {
				for (const t of tables.values()) t.constraints = t.constraints.filter((c) => !c.includes(`INDEX ${m[1]} `));
			} else if (/^(UPDATE|DELETE|SELECT|COMMENT|CREATE EXTENSION|CREATE OR REPLACE FUNCTION|CREATE TRIGGER|DO)\b/i.test(stmt)) {
				// data fixups / plumbing — not schema shape
			} else {
				unhandled.push(stmt.split('\n')[0].slice(0, 80));
			}
		}
	}
	return { tables, seeds, unhandled };
}

// ── Routes: TS AST scan for [ 'METHOD', '/path', ...middleware ] tuples ────

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// Route path argument → display text, or null when not statically readable.
// String literal ('/x') and plain template (`/x`) are taken verbatim; a
// template with holes (`${base}/stream`) renders each hole as {name}, keeping
// the static tail — the part an agent actually needs. A single-argument
// path-helper call (admin's at('/_admin/ui')) and a const bound to any of
// these (const scriptPath = at('/_admin/ui/app.js')) resolve to the DEFAULT
// path — the same "record what the package declares" rule as the R() form.
const routePathText = (arg, sf, consts) => {
	if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
		return arg.text.startsWith('/') ? arg.text : null;
	}
	if (ts.isTemplateExpression(arg)) {
		const rendered =
			arg.head.text +
			arg.templateSpans
				.map((s) => `{${s.expression.getText(sf).replace(/\s+/g, ' ')}}` + s.literal.text)
				.join('');
		return rendered.startsWith('/') || rendered.startsWith('{') ? rendered : null;
	}
	if (ts.isCallExpression(arg) && arg.arguments.length === 1) {
		return routePathText(arg.arguments[0], sf, consts);
	}
	if (ts.isIdentifier(arg)) return consts?.get(arg.text) ?? null;
	return null;
};

function collectRoutes(pkgDir) {
	const routes = [];
	const srcDir = join(pkgDir, 'src');
	const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		if (e.name === '__tests__' || e.name.endsWith('.test.ts')) return [];
		const p = join(dir, e.name);
		return e.isDirectory() ? walk(p) : e.name.endsWith('.ts') ? [p] : [];
	});
	for (const file of walk(srcDir)) {
		const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		// Same-file const bindings (const scriptPath = at('/_admin/ui/app.js')) so
		// an identifier path argument can resolve to its declared default.
		const consts = new Map();
		const prescan = (node) => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
				const v = routePathText(node.initializer, sf, consts);
				if (v !== null) consts.set(node.name.text, v);
			}
			ts.forEachChild(node, prescan);
		};
		prescan(sf);
		const visit = (node) => {
			if (
				ts.isArrayLiteralExpression(node) &&
				node.elements.length >= 3 &&
				ts.isStringLiteral(node.elements[0]) && METHODS.has(node.elements[0].text)
			) {
				const path = routePathText(node.elements[1], sf, consts);
				if (path !== null) {
					const chain = node.elements.slice(2).map((el) => el.getText(sf).replace(/\s+/g, ' '));
					routes.push({ method: node.elements[0].text, path, chain });
				}
			}
			// R('id', 'METHOD', '/path', ...middleware) — the route-override helper form
				// (auth). Record the DEFAULT method/path (args 1,2); runtime config.routes
				// overrides don't change what the package declares.
				if (
					ts.isCallExpression(node) &&
					ts.isIdentifier(node.expression) && node.expression.text === 'R' &&
					node.arguments.length >= 4 &&
					ts.isStringLiteral(node.arguments[1]) && METHODS.has(node.arguments[1].text)
				) {
					const path = routePathText(node.arguments[2], sf, consts);
					if (path !== null) {
						const chain = node.arguments.slice(3).map((el) => el.getText(sf).replace(/\s+/g, ' '));
						routes.push({ method: node.arguments[1].text, path, chain });
					}
				}
				// x.addRoute('METHOD', '/path', ...) / x.router.add('METHOD', '/path', ...)
				// — the direct form. core mounts /healthz, /readyz and /metrics this
				// way rather than through a route table, so the array shape above saw
				// none of them and brain.json reported core as having ZERO routes,
				// for probes that every deployment serves.
				if (
					ts.isCallExpression(node) &&
					ts.isPropertyAccessExpression(node.expression) &&
					(node.expression.name.text === 'addRoute' || node.expression.name.text === 'add') &&
					node.arguments.length >= 3 &&
					ts.isStringLiteral(node.arguments[0]) && METHODS.has(node.arguments[0].text)
				) {
					const path = routePathText(node.arguments[1], sf, consts);
					// Fail loud, never skip: an unreadable registration is a route the
					// brain under-counts and nobody notices. (The R() and tuple forms
					// above stay silent — a bare ['GET', x, …] array is not provably
					// a route; a direct addRoute('GET', x, …) call is.)
					if (path === null) {
						const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
						throw new Error(
							`${file}:${line + 1}:${character + 1} — ${node.expression.name.text}('${node.arguments[0].text}', …) ` +
								`has a path this extractor cannot read: ${node.arguments[1].getText(sf)}.\n` +
								`Two ways forward: make the path statically extractable (a string literal, a template ` +
								`with a static tail like \`\${base}/x\`, or a same-file const of one), or teach ` +
								`routePathText() in scripts/generate-outcomes.mjs the new form. Do not leave it ` +
								`unreadable — the brain would silently under-report routes.`,
						);
					}
					const chain = node.arguments.slice(2).map((el) => el.getText(sf).replace(/\s+/g, ' '));
					routes.push({ method: node.arguments[0].text, path, chain });
				}
				ts.forEachChild(node, visit);
		};
		visit(sf);
	}
	// Stable order: by path then method.
	routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
	return routes;
}

// ── Render ─────────────────────────────────────────────────────────────────

const outDir = join(root, '.claude/skills/fonderie/signatures');
const HEADER = '<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->\n\n';
const written = [];

for (const pkg of PACKAGES) {
	const pkgDir = join(root, 'packages', pkg);
	if (!existsSync(join(pkgDir, 'src'))) continue;
	const pkgName = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).name;
	const sqlDir = join(pkgDir, 'src/migrations/sql');
	const hasSql = existsSync(sqlDir);
	const { tables, seeds, unhandled } = hasSql ? replayMigrations(sqlDir) : { tables: new Map(), seeds: [], unhandled: [] };
	const routes = collectRoutes(pkgDir);
	if (!tables.size && !routes.length) continue;

	const parts = [`# ${pkgName} — outcomes\n`,
		'What this package does to a running app: tables its migrations create,',
		'rows it seeds, routes it registers. Generated from the migration SQL and',
		'route tables in source — trust this file instead of reading `dist/` or',
		'downloading tarballs.\n'];

	if (tables.size) {
		parts.push('## Database tables (after all migrations)\n');
		for (const [name, t] of [...tables.entries()].sort()) {
			parts.push(`### \`${name}\`\n`);
			parts.push('```sql');
			for (const [col, def] of t.columns) parts.push(`${col.padEnd(24)} ${def}`);
			for (const c of t.constraints) parts.push(`-- ${c}`);
			parts.push('```\n');
		}
		if (hasSql) parts.push(`Raw SQL ships in \`node_modules/${pkgName}/dist/migrations/sql/\` — read it there if you must; never download tarballs.\n`);
	}
	if (seeds.length) {
		parts.push('## Seeded rows (behavioral contract)\n');
		parts.push('```sql');
		for (const s of seeds) parts.push(s + ';');
		parts.push('```\n');
	}
	if (routes.length) {
		parts.push('## HTTP routes registered\n');
		parts.push('| Method | Path | Middleware chain (auth / validation / handler) |');
		parts.push('|---|---|---|');
		for (const r of routes) parts.push(`| ${r.method} | \`${r.path}\` | \`${r.chain.join(' → ')}\` |`);
		parts.push('');
	}
	if (unhandled.length) {
		parts.push('## Migration statements not replayed (verify in raw SQL)\n');
		for (const u of unhandled) parts.push(`- \`${u}\``);
		parts.push('');
	}

	const doc = HEADER + parts.join('\n');
	writeFileSync(join(outDir, `${pkg}-outcomes.md`), doc);
	// Co-locate inside the package (R3 — ships in the tarball, version-matched).
	writeFragment(pkgDir, 'outcomes', doc);
	written.push({ pkg, pkgName, tables: tables.size, routes: routes.length });
	process.stdout.write(`  ${pkg} (${tables.size} tables, ${routes.length} routes)\n`);
}

// Append an outcomes section to the SIGNATURES.md index (which
// generate-signatures.mjs rewrites first — this script must run after it).
const idxPath = join(root, '.claude/skills/fonderie/SIGNATURES.md');
const idx = readFileSync(idxPath, 'utf8');
const section = `\n## Outcomes — schemas, seeds, routes\n\nWhat each package does to your app once wired: DB tables created, rows\nseeded, HTTP routes registered (with middleware). **Read the outcomes file\ninstead of excavating \`dist/\` or tarballs.**\n\n${written.map((w) => `- \`${w.pkgName}\` (${w.tables} tables, ${w.routes} routes) → [signatures/${w.pkg}-outcomes.md](signatures/${w.pkg}-outcomes.md)`).join('\n')}\n`;
writeFileSync(idxPath, idx + section);
console.log(`wrote ${written.length} outcomes files + index section`);
