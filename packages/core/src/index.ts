// ── Public API ───────────────────────────────────────────────────
export type {
	ITenant,
	IRouter,
	Operation,
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

export { OPERATIONS } from './constants';

export { FonderieApp } from './app';
export { defineConfig } from './config';
export { compose } from './compose';
export type { FonderieConfig } from './config';

// Built-in middleware — import from '@fonderie/core/middlewares', not the root barrel

// Parser utilities
export { stringOrEmpty, booleanOrFalse, arrayOrEmpty, numberOrZero, dateOrEmpty } from './parser';

// Response helpers
export type { IApiError, HttpStatus } from './response';
export { HTTP, setApiResponse } from './response';

// NOT exported: adapters/, router internals, error-handler, not-found
// Those are consumed by FonderieApp, never by users directly
