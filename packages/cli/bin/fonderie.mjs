#!/usr/bin/env node
// The Fonderie CLI. Two commands, both proven by the N=3 benchmark
// (PLAN-SKILLS-CLI.md — lazy skills beat the eager brain at 0.14 knowledge
// overhead vs fat, at equal completion/quality):
//
//   fonderie skill [--out <dir>] [--project <dir>]
//       Write a LAZY skill into <dir> (default .claude/skills): a small router
//       SKILL.md (always resident) + one body per INSTALLED @fonderie package
//       (read on demand). Load scales with what the agent does, not the catalogue.
//
//   fonderie query <concept>          fonderie query --concepts
//       Answer "what do I install for this capability" — the package, the recipe,
//       the wiring. Zero resident schema tax; the agent runs it only when needed.
//
// Zero deps. Reads the curated knowledge bundled in ./data + each installed
// package's own co-located brain/ fragment (version-matched, shipped in its
// tarball). No MCP server, no build step — a binary + markdown, runs anywhere.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const K = JSON.parse(readFileSync(join(pkgRoot, 'data/knowledge.json'), 'utf8'));
// Package scope — the @fonderiejs 1.0.0 launch flips this one line (see
// MIGRATION-FONDERIEJS.md); every scope reference below derives from it.
const SCOPE = '@fonderie';
const CONCEPTS = Object.entries(K.concepts || {});

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

// installed @fonderie packages in a project (co-located fragments are the data)
function installed(projectDir) {
  const dir = join(projectDir, 'node_modules', SCOPE);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort()
    .filter((n) => existsSync(join(dir, n, 'package.json')))
    .map((n) => ({ name: n, version: JSON.parse(readFileSync(join(dir, n, 'package.json'), 'utf8')).version, dir: join(dir, n) }));
}
const fragment = (pkg) => {
  const f = (name) => { const p = join(pkg.dir, 'brain', name); return existsSync(p) ? readFileSync(p, 'utf8').trim() : ''; };
  return { signatures: f('signatures.md'), outcomes: f('outcomes.md') };
};

// ── fonderie query <concept> ────────────────────────────────────────────────
function doQuery() {
  if (argv.includes('--concepts')) {
    for (const [id, c] of CONCEPTS) console.log(`  ${id.padEnd(24)} ${c.description}`);
    return;
  }
  const id = argv[1];
  const c = id && K.concepts[id];
  if (!c) {
    console.error(`unknown concept "${id ?? ''}". Run \`fonderie query --concepts\` for the list.`);
    process.exit(2);
  }
  const projectDir = arg('--project', process.cwd());
  const inst = installed(projectDir).find((p) => p.name === c.package);
  console.log(`${id} — ${c.description}\n`);
  console.log(`Package: ${SCOPE}/${c.package}${inst ? `@${inst.version} (installed)` : ` — run: npm install ${SCOPE}/${c.package}`}`);
  const recipe = c.recipe && K.recipes[c.recipe];
  if (recipe) {
    console.log(`Recipe: ${c.recipe} — ${recipe.when}`);
    console.log(`Wire:   ${recipe.packages.join(' → ')}`);
    for (const inv of recipe.invariants || []) if (K.invariants[inv]) console.log(`⚠ ${K.invariants[inv]}`);
  }
  if (inst) {
    const fr = fragment(inst);
    if (fr.signatures) console.log(`\n--- exact API (use these, do not guess) ---\n${fr.signatures}`);
    if (fr.outcomes) console.log(`\n--- tables + routes registered ---\n${fr.outcomes}`);
  } else {
    console.log('\nNot installed yet — install it, run its migrations, wire it per the recipe, and continue. Adding the brick IS the task.');
  }
}

// ── fonderie skill — write the lazy router + per-package bodies ──────────────
function doSkill() {
  const projectDir = arg('--project', process.cwd());
  const outDir = arg('--out', join(projectDir, '.claude/skills'));
  const inst = installed(projectDir);
  const instNames = new Set(inst.map((p) => p.name));
  mkdirSync(join(outDir, 'fonderie'), { recursive: true });

  // per-package BODIES (lazy) — only for installed packages, from their own fragment
  let bodies = 0;
  for (const p of inst) {
    const fr = fragment(p);
    if (!fr.signatures && !fr.outcomes) continue;
    const body = [`# ${SCOPE}/${p.name}@${p.version}`, '', fr.signatures, fr.outcomes ? '\n' + fr.outcomes : ''].join('\n').trim();
    writeFileSync(join(outDir, 'fonderie', `${p.name}.md`), body + '\n');
    bodies++;
  }

  // ROUTER SKILL.md — small, always resident
  const L = [];
  L.push('---');
  L.push('name: fonderie');
  L.push('description: Building or modifying a SaaS backend — auth/login/sessions, teams/workspaces, billing/Stripe, roles/permissions, email/SMS, feature flags, audit logs, webhooks, or wiring an API route. Reach for a @fonderie brick instead of hand-writing it.');
  L.push('---');
  L.push('');
  L.push('# Fonderie — router');
  L.push('');
  L.push('Do not hand-write auth, billing, teams, permissions, email, webhooks, rate');
  L.push('limiting, or config. Use the audited `@fonderie/*` brick. For the capability');
  L.push('your task needs, **read only that package\'s body** — do not load them all.');
  L.push('');
  L.push(`Installed here: ${inst.length ? inst.map((p) => `\`${SCOPE}/${p.name}@${p.version}\``).join(', ') : 'none yet'}.`);
  L.push('');
  L.push('## Capability → read this / or discover');
  L.push('');
  L.push('| Task needs… | Package | Read (installed) | Or discover (any) |');
  L.push('| --- | --- | --- | --- |');
  for (const [id, c] of CONCEPTS) {
    const readCol = instNames.has(c.package) ? `\`fonderie/${c.package}.md\`` : '— (not installed)';
    L.push(`| ${c.description} | \`${c.package}\` | ${readCol} | \`fonderie query ${id}\` |`);
  }
  L.push('');
  L.push('**Not installed?** Run the discover command — it names the package + recipe.');
  L.push('Then `npm install @fonderie/<pkg>`, run its migrations, wire it, and continue.');
  L.push('Do NOT stop to ask permission or abandon the task; adding the brick IS the task.');
  L.push('Pick sensible defaults for provider/config choices behind fail-fast env vars.');
  L.push('');
  L.push('## Definition of done — you do NOT need a database to build');
  L.push('');
  L.push('A Fonderie app is **done** when it **typechecks** (`tsc` clean) and each');
  L.push('capability is **wired per its recipe**. That is sufficient: the bricks are');
  L.push('audited and own their schema — migrations ship inside the package and run');
  L.push('automatically on boot, and each route is guaranteed by the package, not by');
  L.push('your app. (Confirmed: a typecheck-clean wired app boots, self-migrates, and');
  L.push('serves the brick routes with no hand-written glue.)');
  L.push('');
  L.push('While building:');
  L.push('- Do NOT provision a database — no `docker run`, no `initdb`, no testcontainers.');
  L.push('- Do NOT boot the app to "check it works": a clean typecheck + correct wiring');
  L.push('  IS the check. Running it is a separate, optional step the operator does');
  L.push('  later with a real `DATABASE_URL`.');
  L.push('- The tables each brick creates are listed in its body — read them, do not');
  L.push('  reverse-engineer them from a running database.');
  L.push('');
  if (Object.keys(K.invariants || {}).length) {
    L.push('## Security invariants (always apply)');
    L.push('');
    for (const [k, v] of Object.entries(K.invariants).sort()) L.push(`- **${k}**: ${v}`);
    L.push('');
  }
  writeFileSync(join(outDir, 'SKILL.md'), L.join('\n') + '\n');
  const routerTok = Math.ceil(L.join('\n').length / 4);
  console.log(`Wrote ${outDir}/SKILL.md (router ~${routerTok} tok, always resident) + ${bodies} lazy bodies in fonderie/.`);
  console.log('Point your agent at .claude/skills. Bodies load only when a task touches that package.');
}

// ── fonderie init — generate the skill AND keep it fresh on install/update ───
// Freshness by construction (the R3 goal): a `postinstall` regenerates the skill
// from node_modules every time packages change, so the resident knowledge is
// always version-matched to the lockfile — no manual re-run, no skew.
function doInit() {
  doSkill();
  const projectDir = arg('--project', process.cwd());
  const pjPath = join(projectDir, 'package.json');
  if (!existsSync(pjPath)) { console.log('\n(no package.json here — skipped postinstall wiring; run `fonderie skill` after installs to refresh.)'); return; }
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  pj.scripts ||= {};
  const HOOK = 'fonderie skill';
  const cur = pj.scripts.postinstall;
  if (cur && cur.includes(HOOK)) {
    console.log('\n✓ postinstall already refreshes the skill.');
  } else if (cur) {
    // don't clobber an existing postinstall — chain ours, idempotently
    pj.scripts.postinstall = `${cur} && ${HOOK}`;
    writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
    console.log(`\n✓ Appended \`${HOOK}\` to your existing postinstall (regenerates the skill on every install).`);
  } else {
    pj.scripts.postinstall = HOOK;
    writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
    console.log(`\n✓ Added \`"postinstall": "${HOOK}"\` — the skill regenerates on every install/update, staying version-matched.`);
  }
}

// ── fonderie add <capability> — deterministic wiring in ONE command ─────────
// Instead of the agent reasoning through install → migrate → compose → mount
// across many turns, it runs ONE command that does the DETERMINISTIC part — npm
// install, a version-matched composition module, the env template, the migration
// step — driven by the recipe, not by LLM guessing. Emits code that matches the
// maintained example-express composition (the ground-truth wiring), verified to
// typecheck against the installed packages.
//
// Value: correctness + DX (one command → version-matched wiring that compiles),
// NOT a token/turn saving. We prototyped it as a turn-count lever and pre-
// registered a gate; the auth-session pilot (DISCOVERY-ADD-WIRING.md) found the
// wiring was ~1 command's worth of a ~62-turn session — the turns live in
// orientation + writing/testing the app's own surface, not the brick wiring —
// so it did NOT cut turns (62 vs a 61–81 baseline). Kept as a DX feature, not
// sold as an efficiency edge.
//
// Per-module wiring spec: import + construction + migrations + env. Deterministic
// and version-matched — the installed package ships the real API these lines call.
const MODULE_SPECS = {
  // `order` = construction/registration priority. Lower first. auth depends on
  // events.bus, so events (2) must precede auth (3) — the canonical example order.
  store:  { pkg: 'store',  order: 0, import: `import { PGAdapter, MigrationRunner, InternalMigrationRunner } from '${SCOPE}/store';`, ctor: null, migrations: false },
  core:   { pkg: 'core',   order: 1, import: `import { FonderieApp, defineConfig } from '${SCOPE}/core';`, ctor: null, migrations: false },
  events: { pkg: 'events', order: 2, import: `import { EventsModule } from '${SCOPE}/events';\nimport { getMigrationsPath as evtMig } from '${SCOPE}/events/migrations';`,
            varName: 'events', ctor: `const events = new EventsModule({ transport: { type: 'pg', connectionUrl: config.db.url } });`, migrations: 'evtMig()' },
  auth:   { pkg: 'auth',   order: 3, import: `import { AuthModule } from '${SCOPE}/auth';\nimport { getMigrationsPath as authMig } from '${SCOPE}/auth/migrations';`,
            varName: 'auth', ctor: `const auth = new AuthModule(store, {\n  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-min-32-chars-long-here',\n  appName: 'App',\n  providers: ['email'],\n  requireVerification: false,\n}, events.bus);`, migrations: 'authMig()',
            env: { JWT_SECRET: 'dev-secret-min-32-chars-long-here' } },
};

function doAdd() {
  const capability = argv[1];
  const projectDir = arg('--project', process.cwd());
  // resolve capability → recipe (accept a concept id, a recipe name, or a bare package)
  let recipeName = capability;
  if (K.concepts[capability]?.recipe) recipeName = K.concepts[capability].recipe;
  const recipe = K.recipes[recipeName];
  if (!recipe) {
    console.error(`unknown capability "${capability ?? ''}". Try a concept (\`fonderie query --concepts\`) or a recipe: ${Object.keys(K.recipes).join(', ')}`);
    process.exit(2);
  }
  // module set in dependency order (spec.order): store, core, then modules with
  // deps before dependents (events before auth). Dedup, keep only recipe packages.
  const wanted = [...new Set(['store', 'core', ...recipe.packages])];
  const unknown = wanted.filter((p) => !MODULE_SPECS[p]);
  const order = wanted.filter((p) => MODULE_SPECS[p]).sort((a, b) => MODULE_SPECS[a].order - MODULE_SPECS[b].order);
  const specs = order.map((p) => MODULE_SPECS[p]);
  if (unknown.length) {
    console.error(`recipe "${recipeName}" needs packages this prototype can't wire yet: ${unknown.join(', ')}. Wired recipes: ${Object.entries(K.recipes).filter(([, r]) => r.packages.every((p) => MODULE_SPECS[p])).map(([n]) => n).join(', ') || '(none)'}`);
    process.exit(3);
  }
  const pkgs = [...new Set(order)];
  const registrable = specs.filter((s) => s.varName);

  // 1) install (deterministic) — packages + the express adapter it mounts through
  const installList = [...pkgs.map((p) => `${SCOPE}/${p}`), `${SCOPE}/adapter-express`];
  console.log(`fonderie add ${recipeName}: installing ${installList.join(' ')} …`);
  const npm = spawnSync('npm', ['install', ...installList], { cwd: projectDir, stdio: 'inherit' });
  if (npm.status !== 0) { console.error('npm install failed — aborting before writing wiring.'); process.exit(1); }

  // 2) emit the composition module (version-matched to what we just installed)
  const migCalls = specs.filter((s) => s.migrations).map((s) => s.migrations);
  const lines = [
    `// GENERATED by \`fonderie add ${recipeName}\` — deterministic wiring. Safe to edit;`,
    `// re-running \`fonderie add\` overwrites it. Composes the audited @fonderie bricks.`,
    `import { fileURLToPath } from 'node:url';`,
    `import { join } from 'node:path';`,
    ...specs.map((s) => s.import),
    ``,
    `const __dirname = fileURLToPath(new URL('.', import.meta.url));`,
    ``,
    `const config = defineConfig({ db: { url: process.env['DATABASE_URL'] ?? 'postgres://localhost/app' } });`,
    `export const store = new PGAdapter(config.db.url);`,
    ``,
    ...(migCalls.length ? [`for (const dir of [${migCalls.join(', ')}]) {`, `  await new InternalMigrationRunner(store, dir).run();`, `}`, ``] : []),
    ...registrable.map((s) => s.ctor),
    ``,
    `export { config };`,
    `export const fonderie = new FonderieApp(config)`,
    ...registrable.map((s, i) => `  .register(${s.varName})${i === registrable.length - 1 ? ';' : ''}`),
    ``,
    `await fonderie.boot();`,
    ``,
  ];
  mkdirSync(join(projectDir, 'src'), { recursive: true });
  const compPath = join(projectDir, 'src/fonderie.ts');
  writeFileSync(compPath, lines.join('\n'));
  console.log(`✓ wrote src/fonderie.ts — composes ${registrable.map((s) => s.varName).join(' + ')} on FonderieApp.`);

  // 3) env template (deterministic, from the spec + recipe invariants)
  const envAdds = { DATABASE_URL: 'postgres://localhost/app', ...Object.assign({}, ...specs.map((s) => s.env || {})) };
  const envPath = join(projectDir, '.env.example');
  const existingEnv = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  let envOut = existingEnv;
  for (const [k, v] of Object.entries(envAdds)) if (!new RegExp(`^${k}=`, 'm').test(envOut)) envOut += `${envOut && !envOut.endsWith('\n') ? '\n' : ''}${k}=${v}\n`;
  if (envOut !== existingEnv) { writeFileSync(envPath, envOut); console.log(`✓ .env.example — added ${Object.keys(envAdds).join(', ')}`); }

  // 4) the ONE app-specific line the agent still owns — printed, not guessed
  console.log(`\nDone. Two lines left for your app entry (e.g. src/index.ts):`);
  console.log(`    import { mount } from '${SCOPE}/adapter-express';`);
  console.log(`    import { fonderie } from './fonderie';`);
  console.log(`  then wrap your express app:  const app = mount(express(), fonderie);`);
  for (const inv of recipe.invariants || []) if (K.invariants[inv]) console.log(`  ⚠ ${K.invariants[inv]}`);
  console.log(`\nMigrations run automatically on boot (InternalMigrationRunner above). Set DATABASE_URL and start the app.`);
}

// ── fonderie config|secret <verb> — manage a live deployment over the admin API ─
// Thin client over @fonderie/config's /admin/* surface. Auth + endpoint come from
// the environment so the LLM never handles the token inline:
//   FONDERIE_ADMIN_URL   e.g. https://app.example.com
//   FONDERIE_ADMIN_TOKEN the bootstrap admin token
//   FONDERIE_ACTOR       optional — recorded on writes (X-Actor)
async function adminFetch(method, path, body) {
  const base = process.env.FONDERIE_ADMIN_URL;
  const token = process.env.FONDERIE_ADMIN_TOKEN;
  if (!base || !token) {
    console.error('Set FONDERIE_ADMIN_URL and FONDERIE_ADMIN_TOKEN to manage a deployment.');
    process.exit(1);
  }
  const headers = { authorization: `Bearer ${token}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (process.env.FONDERIE_ACTOR) headers['x-actor'] = process.env.FONDERIE_ACTOR;
  const res = await fetch(base.replace(/\/$/, '') + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status >= 400) {
    console.error(json.explanation || json.reason || `HTTP ${res.status}`);
    if (json.details) console.error(JSON.stringify(json.details));
    process.exit(res.status === 409 ? 2 : 1); // 409 conflict → exit 2 (reload + retry)
  }
  const result = json.result;
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
}

// The supported management verbs (kubectl-inspired) — the single source of truth
// for the CLI's config/secret surface. Each maps to a method + optional path
// suffix + what it requires (a key, a body value, a --to-version).
const VERBS = {
  get:      { method: 'GET',    needsKey: false },
  set:      { method: 'PUT',    needsKey: true, needsValue: true },
  delete:   { method: 'DELETE', needsKey: true },
  history:  { method: 'GET',    needsKey: true, suffix: '/revisions' },
  rollback: { method: 'POST',   needsKey: true, suffix: '/rollback', needsToVersion: true },
  reveal:   { method: 'POST',   needsKey: true, suffix: '/reveal', secretOnly: true },
};

// config `value` is parsed (so `set flag true` stores a boolean); secrets stay raw strings.
function parseValue(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

// Per-resource scope/value shape. config & secret scope by environment and carry
// a `value`; templates scope by locale and carry `text` (+ optional subject/html).
const RESOURCE_SHAPE = {
  config:   { scopeFlag: '--env',    scopeParam: 'environment', valueKey: 'value' },
  secret:   { scopeFlag: '--env',    scopeParam: 'environment', valueKey: 'value', rawValue: true },
  template: { scopeFlag: '--locale', scopeParam: 'locale',      valueKey: 'text' },
};

async function resourceCmd(resource, base) {
  const shape = RESOURCE_SHAPE[resource];
  const verb = argv[1];
  const spec = VERBS[verb];
  if (!spec || (spec.secretOnly && resource !== 'secret')) return usageErr(resource);

  const key = argv[2];
  if (spec.needsKey && !key) return usageErr(resource);

  const scope = arg(shape.scopeFlag, undefined);
  const q = scope ? `?${shape.scopeParam}=${encodeURIComponent(scope)}` : '';
  const enc = (k) => encodeURIComponent(k);

  const path = spec.needsKey || key
    ? `${base}/${enc(key)}${spec.suffix ?? ''}${q}`
    : `${base}${q}`;

  let body;
  if (spec.needsValue) {
    const raw = argv[3];
    if (raw === undefined) { console.error(`usage: fonderie ${resource} set <key> <value>`); process.exit(1); }
    body = { [shape.valueKey]: shape.rawValue ? String(raw) : parseValue(raw) };
    if (scope) body[shape.scopeParam] = scope;
    if (resource === 'template') {
      const subject = arg('--subject', undefined);
      const html = arg('--html', undefined);
      if (subject !== undefined) body.subject = subject;
      if (html !== undefined) body.html = html;
    }
    const ifVersion = arg('--if-version', undefined);
    if (ifVersion !== undefined) body.ifVersion = Number(ifVersion);
  } else if (spec.needsToVersion) {
    const toVersion = Number(arg('--to-version'));
    if (!Number.isInteger(toVersion)) { console.error('rollback needs --to-version <n>'); process.exit(1); }
    body = { toVersion };
    if (scope) body[shape.scopeParam] = scope;
  }

  return adminFetch(spec.method, path, body);
}

function usageErr(resource) {
  const verbs = Object.keys(VERBS).filter((v) => !VERBS[v].secretOnly || resource === 'secret');
  const scopeFlag = (RESOURCE_SHAPE[resource] ?? { scopeFlag: '--env' }).scopeFlag;
  console.error(`usage: fonderie ${resource} <${verbs.join('|')}> [key] [value] [${scopeFlag} <s>] [--if-version <n>] [--to-version <n>]`);
  process.exit(1);
}

// ── dispatch ────────────────────────────────────────────────────────────────
if (cmd === 'query') doQuery();
else if (cmd === 'skill') doSkill();
else if (cmd === 'add') doAdd();
else if (cmd === 'init') doInit();
else if (cmd === 'config') resourceCmd('config', '/admin/config').catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'secret') resourceCmd('secret', '/admin/secrets').catch((e) => { console.error(e.message); process.exit(1); });
else if (cmd === 'template') resourceCmd('template', '/admin/templates').catch((e) => { console.error(e.message); process.exit(1); });
else {
  console.log(`fonderie — the Fonderie CLI (lazy skills for coding agents)

  fonderie init [--project <dir>]                  set up the lazy skill + keep it fresh (postinstall)
  fonderie add <capability> [--project <dir>]      deterministically wire a brick: install + compose + migrate + env
  fonderie skill [--out <dir>] [--project <dir>]   write the lazy skill (router + bodies)
  fonderie query <concept>                         what to install for a capability
  fonderie query --concepts                        list every capability

  fonderie config <get|set|delete|history|rollback> [key] [value] [--env <e>] [--if-version <n>] [--to-version <n>]
  fonderie secret <get|set|delete|history|rollback|reveal> [key] [value] [--env <e>] ...
  fonderie template <get|set|delete|history|rollback> [type] [text] [--locale <l>] [--subject <s>] [--html <h>] ...
      manage a live deployment over its admin API — set FONDERIE_ADMIN_URL + FONDERIE_ADMIN_TOKEN

Zero deps. No MCP server. A binary + markdown that runs in any agent harness.`);
  if (cmd && cmd !== 'help' && cmd !== '--help') process.exit(2);
}
