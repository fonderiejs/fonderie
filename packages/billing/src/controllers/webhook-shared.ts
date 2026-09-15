import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';

import type { IBillingEvent, IBillingProvider } from '../providers/types';
import { isConsumedWebhookEvent } from '../webhook-events';

/**
 * Event types already warned about, so a provider retrying the same unknown
 * event every few minutes cannot flood the log. Per process, which is the right
 * granularity: a fresh deploy should say it again.
 */
const warnedUnknownTypes = new Set<string>();

/**
 * Say something, ONCE, when a provider sends an event nothing here consumes.
 *
 * Harmless on its own — no branch matches, the webhook returns 200 and nothing
 * happens. But it means the endpoint's configuration and this package disagree,
 * usually because an event was ticked that no handler wants, or because the
 * provider introduced a new type. Silence there turns a config mistake into
 * something you find out about much later.
 *
 * Note this catches only the harmless direction. The expensive one — an event
 * we DO handle that was never registered — produces no delivery at all, so
 * there is nothing here to notice; `checkWebhookRegistration()` is what finds it.
 */
export function warnOnUnconsumedEvent(type: string, route: string): void {
	if (isConsumedWebhookEvent(type) || warnedUnknownTypes.has(type)) return;
	warnedUnknownTypes.add(type);
	console.warn(
		`[billing] ${route} received '${type}', which no handler consumes. ` +
			`It was accepted and ignored. Either remove it from the endpoint's event ` +
			`selection, or this package needs a handler for it.`,
	);
}

/** Test seam: the warn-once set is process-global by design. */
export function __resetUnconsumedWarningsForTests(): void {
	warnedUnknownTypes.clear();
}

// Shared verification front half of both webhook endpoints: secret presence,
// signature-header extraction, payload read, and provider signature check.
// Returns the normalized event, or the error Response to send as-is.
export async function readWebhookEvent(
	ctx: IFonderieContext,
	secret: string | undefined,
	provider: IBillingProvider,
	missingSecretMessage: string,
): Promise<IBillingEvent | Response> {
	if (!secret) {
		return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', missingSecretMessage);
	}

	const signature =
		ctx.request.headers.get('stripe-signature') ??
		ctx.request.headers.get('paypal-auth-algo') ??
		'';
	if (!signature) {
		return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Missing webhook signature');
	}

	const payload = await ctx.request.text();
	try {
		return await provider.constructEvent({ payload, signature, secret });
	} catch {
		return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Invalid webhook signature');
	}
}
