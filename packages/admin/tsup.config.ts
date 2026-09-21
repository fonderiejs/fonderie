import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig([{ ...baseConfig, entry: ['src/index.ts'], env: { FONDERIE_ADMIN_VERSION: version } }])
