import { defineConfig } from 'tsup'
import { baseConfig }   from '../tsup.base'

export default defineConfig({
	...baseConfig,
	entry: [
		'src/index.ts',
		'src/sql.ts',
		'src/types.ts',
		'src/migrations/index.ts',
	],
})
