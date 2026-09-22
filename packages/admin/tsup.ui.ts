import { defineConfig } from 'tsup'

// The served shell: @fonderie/react-admin-screens compiled once into a single
// browser file. React and the screens are devDependencies — bundled here, never
// required at runtime, so @fonderie/admin stays a backend package with no
// frontend deps for the consumer to install.
export default defineConfig({
	entry:      { 'ui/app': 'src/ui/main.tsx' },
	format:     ['iife'],
	platform:   'browser',
	target:     'es2020',
	minify:     true,
	sourcemap:  false,
	dts:        false,
	clean:      false,       // the main build already cleaned dist
	noExternal: [/.*/],      // bundle everything: the page loads one file
	env:        { NODE_ENV: 'production' },
})
