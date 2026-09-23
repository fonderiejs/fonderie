import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'

// shims: import.meta.url is read to locate the served UI bundle; the CJS build
// needs tsup's shim for it.
export default defineConfig([
	{ ...baseConfig, entry: ['src/index.ts'], env: { ...baseConfig.env }, shims: true },
])
