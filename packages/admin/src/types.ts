import type { IAdminCheck, IAdminCheckReport, IReadinessReport, IRouteEntry } from '@fonderie/core';

export interface IAdminOptions {
	// Guards every route. Unset ⇒ the surface is not registered (404), never open.
	adminToken?: string;
	// Reserved for this module; nothing else can mount under it. Default '/_admin'.
	path?: string;
	// Checks only the application can run (pending migrations, a queue it owns).
	checks?: IAdminCheck[];
	// Per check. Default 10 000.
	checkTimeoutMs?: number;
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
	admin: { version: string };
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
