import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import type { IReadinessProblem } from '@fonderie/core';

import type { IBillingConfig } from '../config';
import type { SubscriberType } from '../types';

// Communication & Record Integrity (docs/BILLING-CAPABILITY-AUDIT.md): a money
// event must reach the customer. Courier only acts on NOTIFICATION_EVENT, and
// billing's flows are webhook-driven (no session), so the app supplies the
// recipient via config.resolveRecipient. Absent path ⇒ nothing sent, which
// checkReadiness flags in production.

// True when this config can move money — a paid subscription plan or the
// stored-value wallet (credit packs). Used to decide whether a receipt path
// is mandatory.
export function billingPaymentsEnabled(config: IBillingConfig): boolean {
	if (config.wallet) return true;
	return config.plans.some((p) => p.monthly?.priceId || p.yearly?.priceId);
}

// Fire-and-forget: resolve the recipient, then emit NOTIFICATION_EVENT so
// courier can render + deliver. No bus, no resolver, or an unresolved
// recipient ⇒ silently skip (the readiness check owns the misconfig warning);
// a resolver/bus error must never break the money operation.
export async function notifyBilling(
	bus: EventBus | undefined,
	config: IBillingConfig,
	opts: {
		subscriberType: SubscriberType;
		subscriberId: string;
		type: string; // a MESSAGE_KEYS value
		data: Record<string, unknown>;
	},
): Promise<void> {
	if (!bus || !config.resolveRecipient) return;
	try {
		const recipient = await config.resolveRecipient(opts.subscriberType, opts.subscriberId);
		if (!recipient) return;
		await bus.emit(NOTIFICATION_EVENT, {
			type: opts.type,
			recipient: {
				email: recipient.email ?? null,
				phone: recipient.phone ?? null,
				deviceToken: recipient.deviceToken ?? null,
			},
			data: opts.data,
		});
	} catch {
		// Communication is best-effort at the call site; delivery failures are
		// courier's concern, and a resolver throw must not fail the webhook.
	}
}

// Production-readiness: taking money without a way to communicate it is a
// Processing-Integrity failure. Error in production, warning elsewhere (so
// dev/test needn't wire courier), mirroring @fonderie/auth's config-guard.
export function collectBillingReadinessProblems(
	config: IBillingConfig,
	hasBus: boolean,
): IReadinessProblem[] {
	const problems: IReadinessProblem[] = [];

	if (billingPaymentsEnabled(config)) {
		const receiptPathWired = hasBus && typeof config.resolveRecipient === 'function';
		if (!receiptPathWired) {
			problems.push({
				module: '@fonderie/billing',
				severity: process.env['NODE_ENV'] === 'production' ? 'error' : 'warning',
				message:
					'payments are enabled but no customer-communication path is configured — ' +
					'pass an EventBus to BillingModule and set config.resolveRecipient so ' +
					'purchase receipts, refund notices, and failed-payment alerts can be ' +
					'delivered (consumer-protection/tax records; SOC 2 Processing Integrity).',
			});
		}
	}

	// Auto-recharge misconfig degrades silently (the top-up just never fires,
	// and a subscriber hits zero unexpectedly), so surface it — a warning, since
	// the low-balance notice still informs and nothing unsafe happens.
	const packIds = new Set((config.wallet?.creditPacks ?? []).map((p) => p.id));
	const canChargeOffSession = typeof config.provider.chargeOffSession === 'function';
	for (const plan of config.plans) {
		const auto = plan.wallet?.autoRecharge;
		if (!auto) continue;
		if (!canChargeOffSession) {
			problems.push({
				module: '@fonderie/billing',
				severity: 'warning',
				message:
					`plan '${plan.name}' enables wallet auto-recharge but provider ` +
					`'${config.provider.name}' does not implement chargeOffSession — auto-recharge will never fire.`,
			});
		}
		if (!packIds.has(auto.packId)) {
			problems.push({
				module: '@fonderie/billing',
				severity: 'warning',
				message:
					`plan '${plan.name}' auto-recharge references unknown credit pack '${auto.packId}' — ` +
					'auto-recharge will never fire. Add it to config.wallet.creditPacks.',
			});
		}
	}

	return problems;
}
