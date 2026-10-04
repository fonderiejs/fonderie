import type { IEventCatalogEntry, IEventCatalogEntryWithModule } from './event-catalog';
import type { ILocaleSettings } from './locale';

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
/**
 * Values a message wants formatted in its READER's language, under the reserved
 * data key `$format` (COURIER_FORMAT_KEY). Courier formats each one into the
 * key of the same name once it knows the language — 19,99 $ for a fr-CA
 * reader, $19.99 for en-CA. The sender still puts a plain-string version under
 * that key: a courier that predates this ignores `$format` and shows it.
 *
 *   data: { amountPaidDisplay: '$19.99', $format: { amountPaidDisplay: { money: { amount: '1999', currency: 'CAD', precision: 2 } } } }
 */
export type ICourierFormatValue =
	| { money: { amount: string; currency: string; precision: number } }
	| { date: string; style?: 'short' | 'medium' | 'long' | 'full' };

export const COURIER_FORMAT_KEY = '$format';

export interface ICourierMessage {
	type: string;
	/**
	 * The language to write this message in, when the sender knows it (the
	 * signed-in user's, a customer's preferred one). Absent: courier uses the
	 * language of the account the recipient's address belongs to, then
	 * `fallbackLocale`, then the system default.
	 */
	locale?: string;
	/**
	 * The language to use when neither `locale` nor the recipient's own account
	 * says — typically the business's (workspace settings), for someone without
	 * an account yet (an invitee). Never overrides the recipient's own choice.
	 */
	fallbackLocale?: string;
	recipient: {
		email: string | null;
		phone: string | null;
		deviceToken: string | null;
	};
	data: Record<string, unknown>;
}

// A module's built-in default copy for one message type — what ships so a
// notification renders out of the box, before any app override. Same shape a
// courier template (DB row / FS file) resolves to: `text` is required (every
// channel), `subject`/`html` are email-only. A module exports a
// Record<ItsMessageKey, IDefaultTemplate> so an unfilled key is a compile error.
export interface IDefaultTemplate {
	subject?: string;
	text: string;
	html?: string;
	/**
	 * The same email in other languages, keyed by language ('fr', 'es'). The
	 * fields above are the English copy. Built-in copy carries no market-specific
	 * terms, so it matches by language: a fr-CA user gets 'fr'. An app's own saved
	 * versions still win, and still follow the app's fallback chains.
	 */
	locales?: Readonly<Record<string, IDefaultTemplateCopy>>;
}

/** One language's copy of a built-in email. */
export interface IDefaultTemplateCopy {
	subject?: string;
	text: string;
	html?: string;
}

// ── Router interface — avoids circular dep with router.ts ────────
export interface IRouteMatch {
	handler: Middleware;
	params: Record<string, string>;
}

// `module` is absent for routes the application added itself.
export interface IRouteEntry {
	method: string;
	path: string;
	module?: string;
}

export interface IRouter {
	match(method: string, path: string): IRouteMatch | null;
	add(method: string, path: string, handler: Middleware, module?: string): void;
	reserve(prefix: string, module?: string): void;
	list(): IRouteEntry[];
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
	// Set by an adapter's mount() on the context handle() builds for a request
	// its bridge() already ran the global middleware for: that first pass's
	// meta. The global stack runs again inside handle(), so a middleware whose
	// work is a per-request side effect — counting a request against a limit,
	// above all — finds its own first-pass result here and reuses it instead of
	// doing it twice. Read-only by convention; absent outside that second pass.
	bridged?: Readonly<IFonderieContextMeta>;
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

/**
 * What an adapter hands to `handle()` alongside the request. A Web Standard
 * Request carries no socket address (and no framework state), so anything the
 * adapter resolved from its native request — the client IP above all — must be
 * seeded here or it is lost: `handle()` builds a fresh context.
 */
export interface IHandleInit {
	meta?: IFonderieContextMeta;
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
	// Claim a prefix for the installing module; a collision in either order throws at boot.
	reserve(prefix: string): void;
	routes(): IRouteEntry[];
	listen(port: number, options?: { name?: string; version?: string; env?: string }): void;
	// Install every registered module (dependency-ordered). Returns the app.
	boot(): Promise<IFonderieApp>;
	// Aggregate every module's self-reported readiness problems; gate a deploy
	// or expose from a readiness endpoint. See IReadinessReport.
	checkProductionReadiness(): IReadinessReport;
	// Point-in-time control-posture snapshot for SOC 2 evidence.
	securityReport(): ISecurityReport;
	// Every registered module's admin description, for modules that give one.
	adminDescriptions(): IAdminDescriptionEntry[];
	// Every registered module's client-deliverable events, merged and validated
	// (throws on an invalid entry or a type declared twice). Optional so
	// hand-rolled test doubles still satisfy the interface.
	eventCatalog?(): IEventCatalogEntryWithModule[];
	// The app's validated locales. Optional so hand-rolled test doubles still
	// satisfy the interface; a module reads `app.locales ?? defineLocales()`.
	readonly locales?: ILocaleSettings;
}

// A production-readiness finding a module reports about its own config.
// `error` means "unsafe to run in production" (e.g. a forgeable-token secret);
// `warning` means "probably a misconfiguration" (e.g. emails that will silently
// drop). Collected across modules by `FonderieApp.checkProductionReadiness`.
export interface IReadinessProblem {
	module: string;
	severity: 'error' | 'warning';
	message: string;
	/** Machine-readable cause (see IFinding). `message` stays the English fallback. */
	reason?: string;
	domain?: string;
	metadata?: Readonly<Record<string, string | number>>;
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
	// Same modules, with the version each reports (absent when it does not).
	modules: Array<{ name: string; version?: string }>;
	readiness: IReadinessReport;
}

// An operator route a module offers to the admin surface. `path` is relative to
// the admin prefix; `handlers` are unguarded — the admin brick applies its own
// token guard when it mounts them.
export interface IAdminRoute {
	method: string;
	path: string;
	handlers: Middleware[];
}

// One thing a check (or a readiness guard) found, in the shape of Google's
// AIP-193 ErrorInfo — the same `reason` field every API response already
// carries:
//   reason   — UPPER_SNAKE, stable, unique within its domain: a contract.
//              Never renamed; a changed meaning gets a new reason.
//   domain   — the brick that emits it ('billing', 'auth', …). domain + reason
//              is the unique key a console, a CLI or an alert keys on.
//   metadata — the raw values the sentence mentions. Values, never English:
//              enum-like values are UPPER_SNAKE so they can be translated too.
//   message  — the English sentence: what logs keep, and the fallback when a
//              console has no translation for domain + reason.
// `severity` overrides the check-level default — a failing check can still
// carry advice lines, and they should not be shown as errors.
export interface IFinding {
	message: string;
	reason?: string;
	domain?: string;
	metadata?: Readonly<Record<string, string | number>>;
	severity?: 'error' | 'advice';
}

// One reconciliation check's answer. `ok` is false only for a hard failure;
// findings that leave `ok` true are advice. `skipped` says why it could not run.
// A finding may be a plain sentence (English, untranslatable) or an IFinding.
export interface IAdminCheckReport {
	ok: boolean;
	findings: Array<string | IFinding>;
	/** Why the check could not run — a sentence, or a finding so it can be translated. */
	skipped?: string | IFinding;
}

// A check the module offers the doctor. `run` reads the other side of a copy
// (a provider, DNS, the database) — it may be slow, it must not throw.
export interface IAdminCheck {
	name: string;
	run(): Promise<IAdminCheckReport>;
}

export interface IAdminDescription {
	routes?: IAdminRoute[];
	checks?: IAdminCheck[];
}

export interface IAdminDescriptionEntry {
	module: string;
	description: IAdminDescription;
}

export interface IFonderieModule {
	name: string;
	// The package version, for the deployment manifest. Inject at build time.
	version?: string;
	deps?: string[];
	install(app: IFonderieApp): void | Promise<void>;
	// Optional: report production-readiness problems with this module's config.
	// Modules opt in; `FonderieApp.checkProductionReadiness` aggregates them.
	checkReadiness?(): IReadinessProblem[];
	/**
	 * Optional: release everything install() acquired — intervals, pools,
	 * listening sockets, LISTEN clients. `FonderieApp.shutdown()` calls it.
	 *
	 * A module that acquires a resource and offers no way to release it keeps
	 * the process alive after shutdown, with no error and no output. That is
	 * not hypothetical: it hung this repo's CI for six release cycles
	 * (@fonderie/events), and @fonderie/webhooks had already grown a private
	 * `stop()` for the same reason with nothing to call it. This is that
	 * convention, made part of the interface so there is one name for it and
	 * the app does not have to know which bricks invented their own.
	 *
	 * Must be idempotent: shutdown() may be called more than once, and a
	 * SIGTERM handler often races an explicit call.
	 */
	stop?(): void | Promise<void>;
	// Optional: what this module offers the admin surface. Read before any
	// install() runs, so derive it from constructor state only.
	describeAdmin?(): IAdminDescription;
	// Optional: which of this module's events a CLIENT may receive (realtime
	// delivery). Default deny — an event without an entry is never delivered.
	// See event-catalog.ts. Derive from constructor state only.
	describeEvents?(): IEventCatalogEntry[];
}

// ── Cross-module vocabulary ───────────────────────────────────────
// Lives in core (not permissions) so packages that only peer on core —
// the adapters — can re-export it without loading optional peers.
export type Operation = 'create' | 'read' | 'update' | 'delete';
