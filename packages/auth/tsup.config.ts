import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'

export default defineConfig({
	...baseConfig,
	entry: [
		'src/index.ts',
		'src/types.ts',
		'src/dtos/user.ts',
		'src/migrations/index.ts',
		'src/middlewares/index.ts',
	],
})
