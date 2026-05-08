import { defineConfig }                 from 'tsup'
import { baseConfig, migrationsConfig } from '../../tsup.base'

export default defineConfig([
	{
		...baseConfig,
		entry: [
			'src/index.ts',
			'src/sql.ts',
			'src/types.ts',
		],
	},
	migrationsConfig,
])
