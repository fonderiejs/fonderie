import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// shims: import.meta.url is read to locate the served UI bundle; the CJS build
// needs tsup's shim for it.
export default defineConfig([
	{ ...baseConfig, entry: ['src/index.ts'], env: { FONDERIE_ADMIN_VERSION: version }, shims: true },
])
