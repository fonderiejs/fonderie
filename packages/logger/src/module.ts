import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { ILoggerConfig } from './config';
import { Logger } from './logger';
import { requestLogger } from './middlewares';
import type { ITraceExporter } from './trace';

export class LoggerModule implements IFonderieModule {
	readonly name = '@fonderie/logger';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly logger: Logger;
	private readonly traceExporter: ITraceExporter | undefined;

	constructor(config: ILoggerConfig = {}) {
		this.logger = new Logger(config);
		this.traceExporter = config.traceExporter;
	}

	install(app: IFonderieApp): void {
		app.use(requestLogger(this.logger, this.traceExporter));
	}
}
