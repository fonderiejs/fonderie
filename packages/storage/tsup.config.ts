import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'
export default defineConfig([{ ...baseConfig, entry: ['src/index.ts', 'src/s3.ts'] }])
