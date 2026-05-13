import type { LogLevel, ILogEntry, ILogTransport } from './types'
import type { ILoggerConfig }                       from './config'
import { ConsoleTransport }                          from './transports/console'

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info:  1,
	warn:  2,
	error: 3,
	fatal: 4,
}

export class Logger {
	private readonly minLevel:   number
	private readonly transports: ILogTransport[]
	private readonly context:    Record<string, unknown>

	constructor(
		private readonly config: ILoggerConfig,
		context: Record<string, unknown> = {},
	) {
		this.minLevel   = LEVELS[config.level ?? 'info']
		this.transports = config.transports ?? [new ConsoleTransport({ pretty: config.pretty })]
		this.context    = context
	}

	child(context: Record<string, unknown>): Logger {
		return new Logger(this.config, { ...this.context, ...context })
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.write('debug', message, context)
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.write('info', message, context)
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.write('warn', message, context)
	}

	error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
		this.write('error', message, context, error instanceof Error ? error : undefined)
	}

	fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
		this.write('fatal', message, context, error instanceof Error ? error : undefined)
	}

	private write(
		level:   LogLevel,
		message: string,
		extra?:  Record<string, unknown>,
		error?:  Error,
	): void {
		if (LEVELS[level] < this.minLevel) return

		const entry: ILogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			...this.context,
			...extra,
		}

		if (error) {
			entry.error = {
				message: error.message,
				stack:   error.stack,
				code:    (error as NodeJS.ErrnoException).code,
			}
		}

		for (const transport of this.transports) {
			void transport.write(entry)
		}
	}
}
