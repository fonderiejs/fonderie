import type { IAdminCheck, IAdminCheckReport, IFinding } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from './config';
import { checkPriceConsistency, priceFindings } from './services/price-consistency';
import { checkWebhookRegistration, webhookFindings } from './services/provider-health';
import { checkSubscriptionDrift, subscriptionDriftFindings } from './services/subscription-drift';

interface IReportLike {
	ok: boolean;
	unsupported?: boolean;
}

function toReport<R extends IReportLike>(
	report: R,
	describe: (r: R) => IFinding[],
): IAdminCheckReport {
	if (report.unsupported)
		return {
			ok: true,
			findings: [],
			skipped: {
				message: 'the provider cannot be asked',
				domain: 'billing',
				reason: 'PROVIDER_CANNOT_BE_ASKED',
			},
		};
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
			run: async () => toReport(await checkPriceConsistency(provider, config), priceFindings),
		},
		{
			name: 'billing.subscription-drift',
			run: async () =>
				toReport(await checkSubscriptionDrift(provider, store), subscriptionDriftFindings),
		},
	];
	// A full URL compared against the provider's, not a route the router deals
	// in — so it stays local rather than pulling core's normalizeMountPath.
	const base = config.publicUrl?.replace(/\/+$/, '');
	checks.push({
		name: 'billing.webhook-registration',
		run: async () => {
			if (!base)
				return {
					ok: true,
					findings: [],
					skipped: {
						message: 'config.publicUrl is not set',
						domain: 'billing',
						reason: 'PUBLIC_URL_NOT_SET',
					},
				};
			const urls = {
				subscriptionUrl: `${base}/billing/webhook`,
				...(config.wallet ? { paymentUrl: `${base}/billing/webhook/payment` } : {}),
			};
			return toReport(await checkWebhookRegistration(provider, urls), webhookFindings);
		},
	});
	return checks;
}
