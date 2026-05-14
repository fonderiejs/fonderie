import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { ILoggerConfig } from './config';
import { Logger } from './logger';
import { requestLogger } from './middlewares';

export class LoggerModule implements IFonderieModule {
	readonly name = '@fonderie-js/logger';
	readonly logger: Logger;

	constructor(config: ILoggerConfig = {}) {
		this.logger = new Logger(config);
	}

	install(app: IFonderieApp): void {
		app.use(requestLogger(this.logger));
	}
}
