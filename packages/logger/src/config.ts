import type { LogLevel, ILogTransport } from './types'

export interface ILoggerConfig {
	level?:      LogLevel
	transports?: ILogTransport[]
	pretty?:     boolean
}
