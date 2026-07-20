<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/logger — signatures

## @fonderie/logger

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface ILogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    requestId?: string;
    userId?: string;
    workspaceId?: string;
    duration?: number;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    [key: string]: unknown;
}

interface ILogTransport {
    write(entry: ILogEntry): void | Promise<void>;
}

interface ILoggerConfig {
    level?: LogLevel;
    transports?: ILogTransport[];
    pretty?: boolean;
}

new Logger(config: ILoggerConfig, context?: Record<string, unknown>): Logger
  .child(context: Record<string, unknown>): Logger
  .debug(message: string, context?: Record<string, unknown> | undefined): void
  .info(message: string, context?: Record<string, unknown> | undefined): void
  .warn(message: string, context?: Record<string, unknown> | undefined): void
  .error(message: string, error?: unknown, context?: Record<string, unknown> | undefined): void
  .fatal(message: string, error?: unknown, context?: Record<string, unknown> | undefined): void

new LoggerModule(config?: ILoggerConfig): LoggerModule
  .name: "@fonderie/logger"
  .logger: Logger
  .install(app: IFonderieApp): void

new FileTransport(path: string): FileTransport
  .write(entry: ILogEntry): void

new ConsoleTransport(opts?: { pretty?: boolean; }): ConsoleTransport
  .write(entry: ILogEntry): void
```
