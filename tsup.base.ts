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
// Append this as a second config entry in any package that exports migrations/.
// Object entry form preserves the output path: dist/migrations/index.js
export const migrationsConfig = {
	entry:     { 'migrations/index': 'src/migrations/index.ts' },
	format:    ['esm'] as Array<'esm' | 'cjs'>,
	dts:       true,
	clean:     false,   // don't wipe the main build
	sourcemap: true,
	splitting: false,
}
