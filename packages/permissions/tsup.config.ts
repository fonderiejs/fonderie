import { defineConfig }                 from 'tsup'
import { baseConfig, migrationsConfig } from '../../tsup.base'

export default defineConfig([
	{
		...baseConfig,
		entry: [
			'src/index.ts',
			'src/config.ts',
			'src/types.ts',
			'src/middlewares/index.ts',
		],
	},
	migrationsConfig,
])
