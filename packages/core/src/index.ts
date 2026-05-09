// ── Public API ───────────────────────────────────────────────────
export type {
	ITenant,
	IRouter,
	IAuthUser,
	Middleware,
	IWorkspace,
	IRouteMatch,
	IFonderieApp,
	IFonderieModule,
	IFonderieContext,
	ICourierMessage,
	IFonderieContextMeta,
} from './types';

export { FonderieApp }  from './app';
export { defineConfig } from './config';
export { compose }      from './compose';
export type { FonderieConfig }  from './config';

// Built-in middleware (user-facing)
export type { CorsOptions } from './middlewares';
export { loggerMiddleware, corsMiddleware, bodyParserMiddleware } from './middlewares';

// Parser utilities
export { stringOrEmpty, booleanOrFalse, arrayOrEmpty, numberOrZero } from './parser';

// Response helpers
export type { IApiError, HttpStatus }                              from './response';
export { HTTP, setApiResponse, setSuccessResponse, setErrorResponse } from './response';

// NOT exported: adapters/, router internals, error-handler, not-found
// Those are consumed by FonderieApp, never by users directly
