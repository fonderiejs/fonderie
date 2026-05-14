import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { Middleware, ICourierMessage } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { IBillingConfig } from '../config';
import type { ICounterBackend } from '../backends/types';
import { MESSAGE_KEYS } from '../config';
import { getSubscription } from '../services/subscriptions';
import { buildBillingContext } from '../services/policy';
import { resolveSubscriber, parseWindowMs } from '../utils';

async function isWorkspaceMember(
	store: IStoreAdapter,
	workspaceId: string,
	userId: string,
): Promise<boolean> {
	const rows = await store.query<{ user_id: string }>(
		`SELECT user_id FROM fonderie_role_user_workspaces
		 WHERE workspace_id = $1 AND user_id = $2 AND removed = false AND suspended = false
		 LIMIT 1`,
		[workspaceId, userId],
	);
	return rows.length > 0;
}

// In-process de-dup: tracks which threshold notifications have fired this session.
// Acceptable to lose on restart (may send one duplicate after a redeploy).
const notified = new Set<string>();

export function withBilling(
	store: IStoreAdapter,
	config: IBillingConfig,
	backend: ICounterBackend,
): Middleware {
	return async (ctx, next) => {
		const subscriber = resolveSubscriber(ctx);

		// No subscriber (unauthenticated / public route) — skip entirely
		if (!subscriber) return next();

		// Verify membership when the subscriber is a workspace
		if (subscriber.type === 'workspace' && ctx.user?.id) {
			const member = await isWorkspaceMember(store, subscriber.id, ctx.user.id);
			if (!member) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Not a member of this workspace');
			}
		}

		// Resolve subscription → plan name (fall back to first plan = free)
		const subscription = await getSubscription(subscriber.type, subscriber.id, store);
		const planName = subscription?.plan ?? config.plans[0]?.name ?? 'free';
		const active =
			!subscription || subscription.status === 'active' || subscription.status === 'trialing';

		const plan = config.plans.find((p) => p.name === planName) ?? config.plans[0];
		if (!plan) return next();

		// Increment windowed (rate-limit) counters and read their current totals
		const counters: Record<string, number> = {};

		for (const [key, entry] of Object.entries(plan.policy ?? {})) {
			if ('enabled' in entry || !entry.window) continue;

			const windowMs = parseWindowMs(entry.window);
			const counterKey = `${subscriber.type}:${subscriber.id}:${key}`;
			counters[key] = await backend.increment(counterKey, windowMs);
		}

		// Build and cache billing context on ctx
		const billingCtx = buildBillingContext({ subscriber, plan, active, counters });
		ctx.meta['billing'] = billingCtx;

		// Block requests that have hit a hard limit
		for (const [key, status] of Object.entries(billingCtx.statuses)) {
			if (status.type === 'counter' && status.status === 'blocked') {
				return setApiResponse(
					HTTP.TOO_MANY_REQUESTS,
					'RATE_LIMIT_EXCEEDED',
					`Limit exceeded for: ${key}`,
					{ key, limit: status.limit, used: status.used, resetsAt: status.resetsAt },
				);
			}
		}

		// Fire threshold notifications (once per subscriber per key per session)
		if (config.notifications) {
			const toNotify: ICourierMessage[] = [];
			const recipient = {
				email: ctx.user?.email ?? null,
				phone: null,
				deviceToken: null,
			};

			for (const [key, status] of Object.entries(billingCtx.statuses)) {
				if (status.type !== 'counter' || status.limit === null) continue;

				const base = `${subscriber.type}:${subscriber.id}:${key}`;

				if (config.notifications.softHit && status.status === 'over_limit') {
					const nk = `${base}:reached`;
					if (!notified.has(nk)) {
						notified.add(nk);
						toNotify.push({
							type: MESSAGE_KEYS.limitReached,
							recipient,
							data: {
								key,
								plan: plan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				} else if (config.notifications.warnAt && status.status === 'warning') {
					const nk = `${base}:warning`;
					if (!notified.has(nk)) {
						notified.add(nk);
						toNotify.push({
							type: MESSAGE_KEYS.limitWarning,
							recipient,
							data: {
								key,
								plan: plan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				}
			}

			if (toNotify.length > 0) {
				const existing = ctx.meta['messages'] as ICourierMessage[] | undefined;
				ctx.meta['messages'] = [...(existing ?? []), ...toNotify];
			}
		}

		return next();
	};
}
