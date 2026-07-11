import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { ILoggerConfig } from './config';
import { Logger } from './logger';
import { requestLogger } from './middlewares';

export class LoggerModule implements IFonderieModule {
	readonly name = '@fonderie/logger';
	readonly logger: Logger;

	constructor(config: ILoggerConfig = {}) {
		this.logger = new Logger(config);
	}

	install(app: IFonderieApp): void {
		app.use(requestLogger(this.logger));
	}
}
