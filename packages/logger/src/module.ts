import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { ILoggerConfig } from './config';
import { Logger } from './logger';
import { requestLogger } from './middlewares';
import type { ITraceExporter } from './trace';

export class LoggerModule implements IFonderieModule {
	readonly name = '@fonderie/logger';
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
