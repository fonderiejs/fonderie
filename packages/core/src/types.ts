// ── Identity contracts ───────────────────────────────────────────
// Owned by core so packages that only peer on core (the adapters) can name
// them without importing optional peers. @fonderie/auth populates `user`/
// `tenant` and @fonderie/workspaces populates `workspace` on the context.
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
	// Install every registered module (dependency-ordered). Returns the app.
	boot(): Promise<IFonderieApp>;
	// Aggregate every module's self-reported readiness problems; gate a deploy
	// or expose from a readiness endpoint. See IReadinessReport.
	checkProductionReadiness(): IReadinessReport;
	// Point-in-time control-posture snapshot for SOC 2 evidence.
	securityReport(): ISecurityReport;
}

// A production-readiness finding a module reports about its own config.
// `error` means "unsafe to run in production" (e.g. a forgeable-token secret);
// `warning` means "probably a misconfiguration" (e.g. emails that will silently
// drop). Collected across modules by `FonderieApp.checkProductionReadiness`.
export interface IReadinessProblem {
	module: string;
	severity: 'error' | 'warning';
	message: string;
}

export interface IReadinessReport {
	// True when there are no `error`-severity problems — safe to boot in prod.
	ok: boolean;
	problems: IReadinessProblem[];
}

// A point-in-time control-posture snapshot for SOC 2 evidence (see
// FonderieApp.securityReport). Serialise it to a file/log as an audit artifact.
export interface ISecurityReport {
	generatedAt: string; // ISO timestamp
	env: string; // NODE_ENV
	registeredModules: string[];
	readiness: IReadinessReport;
}

export interface IFonderieModule {
	name: string;
	deps?: string[];
	install(app: IFonderieApp): void | Promise<void>;
	// Optional: report production-readiness problems with this module's config.
	// Modules opt in; `FonderieApp.checkProductionReadiness` aggregates them.
	checkReadiness?(): IReadinessProblem[];
}

// ── Cross-module vocabulary ───────────────────────────────────────
// Lives in core (not permissions) so packages that only peer on core —
// the adapters — can re-export it without loading optional peers.
export type Operation = 'create' | 'read' | 'update' | 'delete';
