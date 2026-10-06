import { background } from '@fonderie/core';
import type { IFonderieContext, Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';

// The trail (docs/INSIDER-THREAT-DESIGN.md, Phase 1): after a SUCCESSFUL change,
// one event saying which workspace, who did it (`userId` — the audit trail's
// actor) and to whom or what. Ids only: no name, no address, so the trail holds
// no personal data and outlives an erased account — including the actor's own.
//
// A refused or failed request emits nothing: the trail records what happened.

type Facts = Record<string, string | string[] | null | undefined>;

const params = (ctx: IFonderieContext) => (ctx.meta['params'] as Record<string, string> | undefined) ?? {};
const body = (ctx: IFonderieContext) => (ctx.meta['body'] as Record<string, unknown> | undefined) ?? {};

export function trail(
	bus: EventBus | undefined,
	type: string,
	// What the change was about; `result` is the response's `result`, for ids
	// the server created (a new role, the invitations sent).
	facts: (ctx: IFonderieContext, result: Record<string, unknown> | undefined) => Facts = () => ({}),
	// The workspace when the request carried none (create, accept).
	workspaceOf?: (result: Record<string, unknown> | undefined) => string | undefined,
): Middleware {
	return async (ctx, next) => {
		const res = await next();
		if (!bus || res.status < 200 || res.status >= 300) return res;
		const result = facts.length >= 2 || workspaceOf
			? ((await res.clone().json().catch(() => null)) as { result?: Record<string, unknown> } | null)?.result
			: undefined;
		const workspaceId = ctx.workspace?.id ?? workspaceOf?.(result);
		if (!workspaceId) return res;
		const extra = Object.fromEntries(Object.entries(facts(ctx, result)).filter(([, v]) => v !== undefined && v !== null));
		const requestId = ctx.meta['requestId'] as string | undefined;
		await background(
			bus.emit(type, { workspaceId, userId: ctx.user?.id ?? null, ...extra }, requestId !== undefined ? { requestId } : undefined),
		);
		return res;
	};
}

/** The member a route acts on (`:userId`). */
export const target = (ctx: IFonderieContext): Facts => ({ targetUserId: params(ctx)['userId'] });
/** The role a route acts on (`:roleId`, or `roleId` in the body). */
export const roleOf = (ctx: IFonderieContext): Facts => ({
	roleId: params(ctx)['roleId'] ?? (typeof body(ctx)['roleId'] === 'string' ? (body(ctx)['roleId'] as string) : undefined),
});
/** The workspace email / phone / location a route acts on (`:emailId`…), or the one it created. */
export const contactOf =
	(kind: 'email' | 'phone' | 'location') =>
	(ctx: IFonderieContext, result: Record<string, unknown> | undefined): Facts => ({
		[`${kind}Id`]: params(ctx)[`${kind}Id`] ?? ((result?.[kind] as { id?: string } | undefined)?.id),
	});
/** The invitation a route acts on (`:inviteId`). */
export const inviteOf = (ctx: IFonderieContext): Facts => ({ inviteId: params(ctx)['inviteId'] });
