import type { IFonderieContext } from '@fonderie/core';

// Seat limits are OPTIONAL and owned by @fonderie/billing. Per Fonderie's
// architecture law (packages talk only through ctx.meta — no sibling imports),
// we read billing's cached context directly instead of importing its code, so
// workspaces has no build- or runtime-dependency on billing. Billing registered
// → it caches an IBillingContext on ctx.meta['billing'] and seats are enforced;
// billing absent → fail open (no limit), which is the intended default.
export function seatLimitFromMeta(ctx: IFonderieContext): number | null {
	const billing = ctx.meta['billing'] as
		| { statuses?: Record<string, { type?: string; limit?: number }> }
		| undefined;
	const status = billing?.statuses?.['seats'];
	if (!status || status.type === 'feature' || typeof status.limit !== 'number') return null;
	return status.limit;
}
