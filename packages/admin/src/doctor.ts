import type { IAdminCheck, IAdminCheckReport, IFonderieApp } from '@fonderie/core';

import type { IAdminAttention, IAdminCheckResult, IAdminDoctorReport } from './types';

export interface INamedCheck extends IAdminCheck {
	module: string;
}

// Module checks first (sorted by module), then the app's own. A name used
// twice would make a report ambiguous, so it is refused up front.
export function collectChecks(app: IFonderieApp, own: IAdminCheck[]): INamedCheck[] {
	const seen = new Map<string, string>();
	const out: INamedCheck[] = [];
	const add = (module: string, check: IAdminCheck): void => {
		const prior = seen.get(check.name);
		if (prior)
			throw new Error(
				`[fonderie] ${module} cannot offer check "${check.name}": ${prior} already does`,
			);
		seen.set(check.name, module);
		out.push({ ...check, module });
	};
	for (const { module, description } of app.adminDescriptions()) {
		for (const c of description.checks ?? []) add(module, c);
	}
	for (const c of own) add('application', c);
	return out;
}

async function runOne(check: INamedCheck, timeoutMs: number): Promise<IAdminCheckResult> {
	const started = Date.now();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<IAdminCheckReport>((resolve) => {
		timer = setTimeout(
			() => resolve({ ok: false, findings: [`timed out after ${timeoutMs} ms`] }),
			timeoutMs,
		);
	});
	let report: IAdminCheckReport;
	try {
		report = await Promise.race([check.run(), timeout]);
	} catch (err) {
		report = {
			ok: false,
			findings: [`check threw: ${err instanceof Error ? err.message : String(err)}`],
		};
	} finally {
		if (timer) clearTimeout(timer);
	}
	return { name: check.name, module: check.module, ...report, durationMs: Date.now() - started };
}

export async function runDoctor(
	checks: INamedCheck[],
	timeoutMs: number,
): Promise<IAdminDoctorReport> {
	const results = await Promise.all(checks.map((c) => runOne(c, timeoutMs)));
	return { generatedAt: new Date().toISOString(), ok: results.every((r) => r.ok), checks: results };
}

// What needs the operator today: readiness problems as reported, failed
// checks as errors, findings on a passing check as advice. Empty = green.
export function attention(app: IFonderieApp, doctor: IAdminDoctorReport): IAdminAttention {
	const items: IAdminAttention['items'] = [];
	for (const p of app.checkProductionReadiness().problems) {
		items.push({
			source: p.module,
			severity: p.severity === 'error' ? 'error' : 'advice',
			message: p.message,
		});
	}
	for (const c of doctor.checks) {
		if (c.skipped) continue;
		const severity = c.ok ? 'advice' : 'error';
		if (!c.ok && c.findings.length === 0)
			items.push({ source: c.name, severity, message: 'failed' });
		for (const f of c.findings) items.push({ source: c.name, severity, message: f });
	}
	return { generatedAt: doctor.generatedAt, ok: !items.some((i) => i.severity === 'error'), items };
}
