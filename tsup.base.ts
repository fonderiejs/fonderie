import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The version of the package being built, baked in at build time so a module
// can report it at runtime. tsup runs with cwd set to the package directory
// (each build script is a bare `tsup`), so this reads the right package.json
// without every config having to pass its own.
//
// Why a module reports its version at all: the operator's Modules page answers
// "what is actually deployed here". A module that cannot say leaves a row
// reading "not reported", which is honest and useless — the page existed for a
// while answering that question for exactly one module out of six.
const pkgVersion = (() => {
	try {
		return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version ?? '0.0.0-dev'
	} catch {
		return '0.0.0-dev'
	}
})()

// Shared tsup build options — every package spreads this and adds its own entry points.
// Change build behaviour once here rather than in 8 places.
//
// NOTE: spreading this and then setting your own `env` REPLACES this one. Merge
// instead: `env: { ...baseConfig.env, MY_VAR: x }`.
export const baseConfig = {
	format:    ['esm', 'cjs'] as Array<'esm' | 'cjs'>,
	dts:       true,
	clean:     true,
	sourcemap: true,
	splitting: false,
	env:       { FONDERIE_PKG_VERSION: pkgVersion },
}

// getMigrationsPath() uses import.meta.url which is ESM-only.
// Built as a SEPARATE sequential tsup pass (tsup.migrations.ts in each package):
// when this ran as a second entry in the same config array, the two parallel
// dts builds raced and dist/migrations/index.d.ts was lost on multi-entry
// packages. Object entry form preserves the output path: dist/migrations/index.js
export const migrationsConfig = {
	entry:     { 'migrations/index': 'src/migrations/index.ts' },
	format:    ['esm'] as Array<'esm' | 'cjs'>,
	dts:       true,
	clean:     false,   // don't wipe the main build
	sourcemap: true,
	splitting: false,
	// Copy the raw .sql next to the compiled loader. createMigrationsPath()
	// resolves to dist/migrations/sql/ at runtime, but tsup bundles JS only — so
	// without this the tarball ships the loader and NOT the SQL it reads, and a
	// consumer's migrations silently find nothing (verified: @fonderie/auth@1.3.1
	// shipped dist/migrations/index.js but no sql/). `files:["dist"]` then carries
	// them into the package. Guarded for packages that have no migrations/sql.
	onSuccess: 'rm -rf dist/migrations/sql && cp -R src/migrations/sql dist/migrations/sql 2>/dev/null || true',
}
