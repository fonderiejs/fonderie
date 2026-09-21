import type { IAdminCheck, IAdminCheckReport, IReadinessReport, IRouteEntry } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

export interface IAdminOptions {
	// Guards every route. Unset ⇒ the surface is not registered (404), never open.
	adminToken?: string;
	// Reserved for this module; nothing else can mount under it. Default '/_admin'.
	path?: string;
	// Checks only the application can run (pending migrations, a queue it owns).
	checks?: IAdminCheck[];
	// Per check. Default 10 000.
	checkTimeoutMs?: number;
	// Enables the admin log (every request served here, refused ones included)
	// and GET /_admin/activity/admin-log. Run the package's migrations.
	store?: IStoreAdapter;
}

export interface IAdminModuleEntry {
	name: string;
	// null when the module does not report one.
	version: string | null;
	readiness: IReadinessReport;
	// Whether the module implements describeAdmin() — silence is visible, not "nothing".
	describesAdmin: boolean;
}

export interface IAdminManifest {
	generatedAt: string;
	env: string;
	// `log` is false when no store was given: admin actions are not being recorded.
	admin: { version: string; log: boolean };
	modules: IAdminModuleEntry[];
	readiness: IReadinessReport;
	routes: IRouteEntry[];
}

export interface IAdminCheckResult extends IAdminCheckReport {
	name: string;
	module: string;
	durationMs: number;
}

export interface IAdminDoctorReport {
	generatedAt: string;
	ok: boolean;
	checks: IAdminCheckResult[];
}

export interface IAdminAttentionItem {
	source: string;
	severity: 'error' | 'advice';
	message: string;
}

export interface IAdminAttention {
	generatedAt: string;
	ok: boolean;
	items: IAdminAttentionItem[];
}

export interface IAdminLogEntry {
	id: string;
	at: string;
	actor: string;
	method: string;
	path: string;
	route: string;
	module: string;
	status: number;
	durationMs: number;
	requestId: string | null;
	clientIp: string | null;
}

export interface IAdminLogPage {
	entries: IAdminLogEntry[];
	// Pass as `before` for the next page; null at the end.
	next: string | null;
}
