import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';

import type { IBillingEvent, IBillingProvider } from '../providers/types';
import { isConsumedWebhookEvent } from '../webhook-events';

/**
 * Route+type pairs already warned about, so a provider retrying the same event
 * every few minutes cannot flood the log. Per process, which is the right
 * granularity: a fresh deploy should say it again. Keyed by route as well as
 * type, because the same type arriving at the WRONG endpoint is a different
 * fact from it arriving at no endpoint.
 */
const warned = new Set<string>();

/**
 * Say something, ONCE, when an endpoint receives an event it does not consume.
 *
 * The question is deliberately per-ENDPOINT, not global. Asking only "does this
 * package consume this type anywhere?" misses the more common misconfiguration
 * by construction: an event ticked on BOTH endpoints when only one handles it.
 * That type is consumed — just not here — so a global check stays silent while
 * every such event is delivered twice, processed once, and ignored once.
 *
 * (Observed in production: a payment endpoint registered for all fourteen event
 * types instead of its eight, so every subscription event was delivered to both
 * endpoints. Nothing broke, and nothing said so.)
 *
 * Harmless on its own — no branch matches, the webhook returns 200. But it means
 * the endpoint's configuration and this package disagree, and silence there
 * turns a config mistake into something discovered much later.
 *
 * This still only catches the harmless direction. The expensive one — an event
 * we DO handle that was never registered — produces no delivery at all, so there
 * is nothing here to notice; `checkWebhookRegistration()` is what finds it.
 *
 * @param expected the event set THIS route owns. Omit to fall back to the
 *   package-wide check, which cannot see wrong-endpoint delivery.
 */
export function warnOnUnconsumedEvent(
	type: string,
	route: string,
	expected?: readonly string[],
): void {
	const handledHere = expected ? expected.includes(type) : isConsumedWebhookEvent(type);
	const key = `${route}:${type}`;
	if (handledHere || warned.has(key)) return;
	warned.add(key);

	// Distinguish the two causes, because the fixes differ: remove it from this
	// endpoint, versus remove it from the account or add a handler.
	const elsewhere = expected ? isConsumedWebhookEvent(type) : false;
	console.warn(
		elsewhere
			? `[billing] ${route} received '${type}', which is handled by a DIFFERENT ` +
					`endpoint. It was accepted and ignored here, so the event is being ` +
					`delivered twice. Remove it from this endpoint's event selection.`
			: `[billing] ${route} received '${type}', which no handler consumes. ` +
					`It was accepted and ignored. Either remove it from the endpoint's event ` +
					`selection, or this package needs a handler for it.`,
	);
}

/** Test seam: the warn-once set is process-global by design. */
export function __resetUnconsumedWarningsForTests(): void {
	warned.clear();
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
