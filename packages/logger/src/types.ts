export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface ILogEntry {
	level:        LogLevel
	message:      string
	timestamp:    string
	requestId?:   string
	userId?:      string
	workspaceId?: string
	duration?:    number
	error?: {
		message: string
		stack?:  string
		code?:   string
	}
	[key: string]: unknown
}

export interface ILogTransport {
	write(entry: ILogEntry): void | Promise<void>
}
