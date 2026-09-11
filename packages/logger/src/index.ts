export type { LogLevel, ILogEntry, ILogTransport } from './types';
export type { ILoggerConfig } from './config';

export { Logger } from './logger';
export { LoggerModule } from './module';
export { FileTransport } from './transports/file';
export { ConsoleTransport } from './transports/console';

export { logSecurityEvent } from './security-event';
export type { ISecurityEvent, SecurityAction } from './security-event';

// Distributed tracing (W3C trace context + span export — no required deps).
export {
	ConsoleTraceExporter,
	OtlpHttpTraceExporter,
	formatTraceparent,
	newTraceContext,
	parseTraceparent,
} from './trace';
export type { ITraceContext, ITraceExporter, ISpan, IOtlpExporterOptions } from './trace';
