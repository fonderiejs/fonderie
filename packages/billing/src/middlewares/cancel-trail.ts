import { background } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';

import { EVENT_KEYS } from '../config';
import { resolveSubscriber } from '../utils';

type Bus = { emit(type: string, payload: unknown, opts?: { requestId?: string }): Promise<void> };

// Who cancelled the plan (docs/INSIDER-THREAT-DESIGN.md, Phase 6): after a
// SUCCESSFUL cancel, one event naming the subscriber, the person who did it and
// whether it ends now or at period end. Ids only. @fonderie/workspaces alerts
// the owner when someone else ended a team's plan.
export function cancelTrail(bus?: Bus): Middleware {
	return async (ctx, next) => {
		const res = await next();
		if (!bus || res.status < 200 || res.status >= 300) return res;
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) return res;
		const atPeriodEnd = (ctx.meta['body'] as { atPeriodEnd?: boolean } | undefined)?.atPeriodEnd ?? true;
		const requestId = ctx.meta['requestId'] as string | undefined;
		await background(
			bus.emit(
				EVENT_KEYS.subscriptionCancelRequested,
				{
					...(subscriber.type === 'workspace' ? { workspaceId: subscriber.id } : {}),
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					userId: ctx.user?.id ?? null,
					atPeriodEnd,
				},
				requestId !== undefined ? { requestId } : undefined,
			),
		);
		return res;
	};
}
