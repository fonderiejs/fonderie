import type { IAdminCheck, IAdminCheckReport, IFinding, IFonderieApp } from '@fonderie/core';

import type {
	IAdminAttention,
	IAdminCheckResult,
	IAdminDoctorReport,
	IAdminFinding,
} from './types';

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
			() =>
				resolve({
					ok: false,
					findings: [
						{
							message: `timed out after ${timeoutMs} ms`,
							domain: 'admin',
							reason: 'CHECK_TIMED_OUT',
							metadata: { ms: timeoutMs },
						},
					],
				}),
			timeoutMs,
		);
	});
	let report: IAdminCheckReport;
	try {
		report = await Promise.race([check.run(), timeout]);
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		report = {
			ok: false,
			findings: [
				{
					message: `check threw: ${detail}`,
					domain: 'admin',
					reason: 'CHECK_THREW',
					metadata: { detail },
				},
			],
		};
	} finally {
		if (timer) clearTimeout(timer);
	}
	const details = normalizeFindings(report);
	return {
		name: check.name,
		module: check.module,
		ok: report.ok,
		...(report.skipped
			? typeof report.skipped === 'string'
				? { skipped: report.skipped }
				: { skipped: report.skipped.message, skippedDetail: toDetail(report.skipped, 'advice') }
			: {}),
		findings: details.map((d) => d.message),
		details,
		durationMs: Date.now() - started,
	};
}

// A plain string is an untranslatable English finding; an object may carry a
// code. Severity defaults to the check's own verdict: a failing check's
// findings are errors, a passing check's are advice — unless the finding says.
export function normalizeFindings(report: IAdminCheckReport): IAdminFinding[] {
	const fallback = report.ok ? 'advice' : 'error';
	return report.findings.map((f) => toDetail(f, fallback));
}

function toDetail(f: string | IFinding, fallback: 'error' | 'advice'): IAdminFinding {
	if (typeof f === 'string') return { message: f, severity: fallback };
	return {
		message: f.message,
		...(f.reason ? { reason: f.reason } : {}),
		...(f.domain ? { domain: f.domain } : {}),
		...(f.metadata ? { metadata: f.metadata } : {}),
		severity: f.severity ?? fallback,
	};
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
			...(p.reason ? { reason: p.reason } : {}),
			...(p.domain ? { domain: p.domain } : {}),
			...(p.metadata ? { metadata: p.metadata } : {}),
		});
	}
	for (const c of doctor.checks) {
		if (c.skipped) continue;
		if (!c.ok && c.details.length === 0)
			items.push({
				source: c.name,
				severity: 'error',
				message: 'failed',
				domain: 'admin',
				reason: 'CHECK_FAILED',
			});
		// Each finding keeps its own severity: an advice line inside a failing
		// check is still advice (it used to be shown as an error).
		for (const d of c.details) items.push({ source: c.name, ...d });
	}
	return { generatedAt: doctor.generatedAt, ok: !items.some((i) => i.severity === 'error'), items };
}
