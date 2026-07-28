import { defineConfig } from 'tsup';

// Bundle the CLI into a single self-contained ESM file at dist/bin.js.
// Everything is bundled so the published package runs without a node_modules
// resolution step for its own deps at the user's install time.
export default defineConfig({
	entry: { bin: 'src/bin.ts' },
	format: ['esm'],
	target: 'node18',
	clean: true,
	sourcemap: false,
	dts: false,
	// Keep giget external — it pulls in a large tree of helpers that we don't
	// want to inline, and it resolves fine as a normal dependency at runtime.
	banner: { js: '#!/usr/bin/env node' },
});
