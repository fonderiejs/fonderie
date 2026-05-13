import type { ILogEntry, ILogTransport } from '../types'

const COLORS: Record<string, string> = {
	debug: '\x1b[36m',
	info:  '\x1b[32m',
	warn:  '\x1b[33m',
	error: '\x1b[31m',
	fatal: '\x1b[35m',
}
const RESET = '\x1b[0m'
const DIM   = '\x1b[2m'

export class ConsoleTransport implements ILogTransport {
	constructor(private opts: { pretty?: boolean } = {}) {}

	write(entry: ILogEntry): void {
		const pretty = this.opts.pretty ?? process.env['NODE_ENV'] !== 'production'

		if (pretty) {
			const color  = COLORS[entry.level] ?? ''
			const label  = entry.level.toUpperCase().padEnd(5)
			const { level, message, timestamp, error, ...rest } = entry
			const keys   = Object.keys(rest)
			const meta   = keys.length ? ` ${DIM}${JSON.stringify(rest)}${RESET}` : ''
			const out    = `${color}${label}${RESET} ${DIM}${timestamp}${RESET} ${message}${meta}\n`

			if (entry.level === 'error' || entry.level === 'fatal') {
				process.stderr.write(out)
				if (error) process.stderr.write(`       ${error.message}\n${error.stack ? `       ${error.stack}\n` : ''}`)
			} else {
				process.stdout.write(out)
			}
		} else {
			const line = JSON.stringify(entry) + '\n'
			if (entry.level === 'error' || entry.level === 'fatal') {
				process.stderr.write(line)
			} else {
				process.stdout.write(line)
			}
		}
	}
}
