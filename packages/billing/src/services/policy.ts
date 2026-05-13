import type { IBillingPlan }                              from '../config'
import type { LimitStatus, IPolicyStatus, IBillingContext,
              SubscriberType }                             from '../types'
import { parseWindowMs }                                   from '../utils'

export function buildBillingContext(opts: {
	subscriber: { type: SubscriberType; id: string }
	plan:       IBillingPlan
	active:     boolean
	// Pre-fetched windowed counter values keyed by policy key.
	// Non-windowed counter keys are absent (their used count is 0 — app manages those).
	counters:   Record<string, number>
}): IBillingContext {
	const { subscriber, plan, active, counters } = opts
	const defaults  = plan.defaults ?? {}
	const statuses: Record<string, IPolicyStatus> = {}

	for (const [key, entry] of Object.entries(plan.policy ?? {})) {
		if ('enabled' in entry) {
			statuses[key] = { type: 'feature', enabled: entry.enabled }
			continue
		}

		const {
			limit,
			buffer = defaults.buffer ?? 0,
			warnAt = defaults.warnAt ?? 0.8,
			window,
		} = entry

		const used      = counters[key] ?? 0
		const hardLimit = limit !== null ? limit + buffer : null

		let status: LimitStatus = 'ok'
		if      (hardLimit !== null && used >= hardLimit)        status = 'blocked'
		else if (limit     !== null && used >= limit)            status = 'over_limit'
		else if (limit     !== null && used >= limit * warnAt)   status = 'warning'

		let resetsAt: string | null = null
		if (window) {
			const windowMs    = parseWindowMs(window)
			const windowStart = Math.floor(Date.now() / windowMs) * windowMs
			resetsAt = new Date(windowStart + windowMs).toISOString()
		}

		statuses[key] = { type: 'counter', limit, used, status, resetsAt }
	}

	return { subscriber, plan: plan.name, active, statuses }
}
