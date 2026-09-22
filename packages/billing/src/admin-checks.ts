import type { IAdminCheck, IAdminCheckReport } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from './config';
import { checkPriceConsistency, describePriceProblems } from './services/price-consistency';
import { checkWebhookRegistration, describeWebhookProblems } from './services/provider-health';
import { checkSubscriptionDrift, describeSubscriptionDrift } from './services/subscription-drift';

interface IReportLike {
	ok: boolean;
	unsupported?: boolean;
}

function toReport<R extends IReportLike>(
	report: R,
	describe: (r: R) => string[],
): IAdminCheckReport {
	if (report.unsupported)
		return { ok: true, findings: [], skipped: 'the provider cannot be asked' };
	return { ok: report.ok, findings: describe(report) };
}

// The reconciliation checks this module can run from its own config. Webhook
// registration needs publicUrl — the one fact only the deployment knows.
export function describeBillingAdminChecks(
	store: IStoreAdapter,
	config: IBillingConfig,
): IAdminCheck[] {
	const { provider } = config;
	const checks: IAdminCheck[] = [
		{
			name: 'billing.price-consistency',
			run: async () =>
				toReport(await checkPriceConsistency(provider, config), describePriceProblems),
		},
		{
			name: 'billing.subscription-drift',
			run: async () =>
				toReport(await checkSubscriptionDrift(provider, store), describeSubscriptionDrift),
		},
	];
	// A full URL compared against the provider's, not a route the router deals
	// in — so it stays local rather than pulling core's normalizeMountPath.
	const base = config.publicUrl?.replace(/\/+$/, '');
	checks.push({
		name: 'billing.webhook-registration',
		run: async () => {
			if (!base) return { ok: true, findings: [], skipped: 'config.publicUrl is not set' };
			const urls = {
				subscriptionUrl: `${base}/billing/webhook`,
				...(config.wallet ? { paymentUrl: `${base}/billing/webhook/payment` } : {}),
			};
			return toReport(await checkWebhookRegistration(provider, urls), describeWebhookProblems);
		},
	});
	return checks;
}
