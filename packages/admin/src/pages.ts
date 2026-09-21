import type { IFonderieApp, IReadinessProblem } from '@fonderie/core';

import type { IAdminConfigReport, IAdminRoutesReport, IAdminTokensReport } from './types';

export function configReport(app: IFonderieApp, env: string[]): IAdminConfigReport {
	const report = app.securityReport();
	const byModule = new Map<string, IReadinessProblem[]>();
	for (const p of report.readiness.problems)
		byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]);
	return {
		generatedAt: report.generatedAt,
		readiness: report.readiness,
		modules: report.modules.map(({ name }) => ({ name, problems: byModule.get(name) ?? [] })),
		env: env.map((name) => ({
			name,
			set: process.env[name] !== undefined && process.env[name] !== '',
		})),
	};
}

const PROBES = new Set(['/healthz', '/readyz', '/metrics']);

export function routesReport(app: IFonderieApp, adminModule: string): IAdminRoutesReport {
	return {
		generatedAt: new Date().toISOString(),
		routes: app.routes().map((r) => ({
			...r,
			guard:
				r.module === adminModule
					? 'admin'
					: PROBES.has(r.path) && r.module === '@fonderie/core'
						? 'probe'
						: 'app',
		})),
	};
}

// A brick's own adminToken shows as a readiness problem only when weak, so
// "set at all" has to be asked; a described module that also registers a
// legacy route under /admin, /plans or /billing/wallet/grant has one.
export function tokensReport(app: IFonderieApp, adminModule: string): IAdminTokensReport {
	const report = app.securityReport();
	const adminProblems = report.readiness.problems.filter((p) => p.module === adminModule);
	const legacyOwners = new Set(
		app
			.routes()
			.filter((r) => r.module && r.module !== adminModule && isLegacyAdminPath(r.method, r.path))
			.map((r) => r.module as string),
	);
	return {
		generatedAt: report.generatedAt,
		admin: { ok: !adminProblems.some((p) => p.severity === 'error'), problems: adminProblems },
		legacy: report.modules
			.map(({ name }) => ({ module: name, set: legacyOwners.has(name) }))
			.filter((e) => e.set),
	};
}

function isLegacyAdminPath(method: string, path: string): boolean {
	if (/\/admin\/(config|secrets|templates)(\/|$)/.test(path)) return true;
	if (/\/plans(\/|$)/.test(path) && method !== 'GET') return true;
	return /\/billing\/wallet\/grant$/.test(path);
}
