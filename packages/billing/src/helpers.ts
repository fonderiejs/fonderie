import { setApiResponse, HTTP }  from '@fonderie-js/core'
import type { IFonderieContext } from '@fonderie-js/core'
import type { Middleware }        from '@fonderie-js/core'
import type { IBillingContext,
              IPolicyStatus }    from './types'

function getBillingContext(ctx: IFonderieContext): IBillingContext | null {
	return (ctx.meta['billing'] as IBillingContext | undefined) ?? null
}

// Returns true if the feature flag is enabled on the subscriber's plan.
// Returns true when no billing context is present (fail-open when billing not configured).
export function hasFeature(ctx: IFonderieContext, key: string): boolean {
	const billing = getBillingContext(ctx)
	if (!billing) return true

	const status = billing.statuses[key]
	if (!status) return true                        // key not declared in policy → allow
	if (status.type === 'feature') return status.enabled
	return true                                     // counter entry = feature present
}

// Returns the advertised limit for a counter policy key, or null if unlimited / not configured.
export function getPlanLimit(ctx: IFonderieContext, key: string): number | null {
	const billing = getBillingContext(ctx)
	if (!billing) return null

	const status = billing.statuses[key]
	if (!status || status.type === 'feature') return null
	return status.limit
}

// Returns the full policy status for a key, or null if not configured.
export function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null {
	const billing = getBillingContext(ctx)
	if (!billing) return null
	return billing.statuses[key] ?? null
}

// Middleware — gates a route behind a feature flag.
// Reads from cached ctx.meta['billing']; no store arg, no async DB call.
// Fails open if billing context is absent (billing module not registered).
export function requireFeature(key: string): Middleware {
	return (ctx, next) => {
		if (!hasFeature(ctx, key)) {
			return Promise.resolve(
				setApiResponse(
					HTTP.PAYMENT_REQUIRED,
					'FEATURE_UNAVAILABLE',
					`Feature '${key}' is not available on your current plan`,
				),
			)
		}
		return next()
	}
}
