// Shared tsup build options — every package spreads this and adds its own entry points.
// Change build behaviour once here rather than in 8 places.
export const baseConfig = {
	format:    ['esm', 'cjs'] as Array<'esm' | 'cjs'>,
	dts:       true,
	clean:     true,
	sourcemap: true,
	splitting: false,
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
