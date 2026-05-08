import { defineConfig } from 'tsup'
import { baseConfig }   from '../../tsup.base'

export default defineConfig({
	...baseConfig,
	entry: [
		'src/index.ts',
		'src/config.ts',
		'src/types.ts',
		'src/parser.ts',
		'src/response.ts',
		'src/middlewares/index.ts',
	],
})
