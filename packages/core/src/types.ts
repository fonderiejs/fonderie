// ── Stubbed until @fonderie-labs/auth ships ──────────────────────
export interface ITenant {
	id: string;
	slug: string;
	plan: string;
}

export interface IAuthUser {
	id: string;
	email: string | null;
	phone: string | null;
	suspended: boolean;
	mfaEnabled: boolean;
	deletedAt: Date | null;
	emailVerifiedAt: Date | null;
	loginMethod: 'email' | 'phone' | 'google'; // sourced from JWT payload
	phoneVerified: boolean; // per-session, sourced from JWT payload
	mfaPending?: boolean; // true on the short-lived pre-auth token issued during MFA login
	locale: string; // the user's preferred locale (DB row); drives per-locale courier templates
}

export interface IWorkspace {
	id: string;
	name: string;
	isPersonal?: boolean;
}

// ── Courier contract — lives in core because auth + workspaces emit
// messages without importing @fonderie/courier.
export interface ICourierMessage {
	type: string;
	locale?: string;
	recipient: {
		email: string | null;
		phone: string | null;
		deviceToken: string | null;
	};
	data: Record<string, unknown>;
}

// ── Router interface — avoids circular dep with router.ts ────────
export interface IRouteMatch {
	handler: Middleware;
	params: Record<string, string>;
}

export interface IRouter {
	match(method: string, path: string): IRouteMatch | null;
	add(method: string, path: string, handler: Middleware): void;
}

// ── Typed well-known ctx.meta keys ───────────────────────────────
export interface IFonderieContextMeta {
	params?: Record<string, string>;
	body?: unknown;
	// Trust-proxy-resolved client IP, populated by the adapters (see
	// resolveClientIp in @fonderie/core/middlewares). Consumed by
	// @fonderie/rate-limit's byIp() keying.
	clientIp?: string;
	workspaceId?: string;
	userId?: string;
	userWorkspaceRoles?: string[];
	message?: ICourierMessage;
	[key: string]: unknown;
}

// ── Core types ───────────────────────────────────────────────────
export interface IFonderieContext {
	request: Request;
	meta: IFonderieContextMeta;
	readonly tenant: ITenant | null;
	readonly user: IAuthUser | null;
	readonly workspace: IWorkspace | null;
	_router: IRouter;
}

export type Middleware = (
	ctx: IFonderieContext,
	next: () => Promise<Response>,
) => Promise<Response>;

// ── App + module contracts ────────────────────────────────────────
export interface IFonderieApp {
	use(middleware: Middleware): IFonderieApp;
	register(module: IFonderieModule): IFonderieApp;
	addRoute(method: string, path: string, ...handlers: Middleware[]): void;
	listen(port: number, options?: { name?: string; version?: string; env?: string }): void;
}

export interface IFonderieModule {
	name: string;
	deps?: string[];
	install(app: IFonderieApp): void | Promise<void>;
}

// ── Cross-module vocabulary ───────────────────────────────────────
// Lives in core (not permissions) so packages that only peer on core —
// the adapters — can re-export it without loading optional peers.
export type Operation = 'create' | 'read' | 'update' | 'delete';
