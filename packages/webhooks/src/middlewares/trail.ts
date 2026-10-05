import { background } from '@fonderie/core';
import type { IFonderieContext, Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';

// Who changed the webhooks (docs/INSIDER-THREAT-DESIGN.md, Phase 6): after a
// SUCCESSFUL change, one event naming the workspace, the person and the
// endpoint. Only the URL's HOST is recorded — a query string may carry a
// token. @fonderie/workspaces alerts the owner when someone else adds one.
export const WEBHOOK_EVENTS = {
	endpointCreated: 'fonderie.webhook.endpoint.created',
	endpointUpdated: 'fonderie.webhook.endpoint.updated',
	endpointDeleted: 'fonderie.webhook.endpoint.deleted',
	endpointRestored: 'fonderie.webhook.endpoint.restored',
} as const;

export const hostOf = (url: unknown): string | undefined => {
	if (typeof url !== 'string') return undefined;
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
};

type Facts = Record<string, string | undefined>;

export function webhookTrail(
	bus: EventBus | undefined,
	type: string,
	facts: (ctx: IFonderieContext, result: Record<string, unknown> | undefined) => Facts,
): Middleware {
	return async (ctx, next) => {
		const res = await next();
		if (!bus || !ctx.workspace || res.status < 200 || res.status >= 300) return res;
		const result =
			res.status === 204 ? undefined : ((await res.clone().json().catch(() => null)) as { result?: Record<string, unknown> } | null)?.result;
		const extra = Object.fromEntries(Object.entries(facts(ctx, result)).filter(([, v]) => v !== undefined));
		const requestId = ctx.meta['requestId'] as string | undefined;
		await background(
			bus.emit(type, { workspaceId: ctx.workspace.id, userId: ctx.user?.id ?? null, ...extra }, requestId !== undefined ? { requestId } : undefined),
		);
		return res;
	};
}
