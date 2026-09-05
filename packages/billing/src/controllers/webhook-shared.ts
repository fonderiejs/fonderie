import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';

import type { IBillingEvent, IBillingProvider } from '../providers/types';

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
