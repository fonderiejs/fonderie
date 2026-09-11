import type { LogLevel, ILogTransport } from './types';
import type { ITraceExporter } from './trace';

export interface ILoggerConfig {
	level?: LogLevel;
	transports?: ILogTransport[];
	pretty?: boolean;
	// Optional span sink for distributed tracing (ConsoleTraceExporter /
	// OtlpHttpTraceExporter, or your own). Omit to disable span export — the
	// W3C trace context still propagates and shows up in the logs regardless.
	traceExporter?: ITraceExporter;
}
