import { HTTP, background, setApiResponse } from '@fonderie/core';
import type { IFonderieContext, Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { EVENT_KEYS } from '../config';

// The velocity brake (docs/INSIDER-THREAT-DESIGN.md, Phase 5). Every
// successful destructive action by someone who is NOT the owner is counted;
// at `limit` in `windowMinutes`, that person is paused: every braked route
// answers 429 MANAGER_PAUSED until the owner releases them. Reading and
// ordinary work go on — only deleting stops. The owner is never braked.
//
// Put it on any route that destroys (other bricks import it): removing a
// member, deleting a role or a customer or a webhook.

export interface IVelocityBrakeOptions {
	/** Destructive actions allowed in the window. Default 10. */
	limit?: number;
	/** The window, in minutes. Default 10. */
	windowMinutes?: number;
}

type Bus = { emit(type: string, payload: unknown, opts?: { requestId?: string }): Promise<void> };

export const VELOCITY_BRAKE_DEFAULTS = { limit: 10, windowMinutes: 10 } as const;

const paused = () =>
	setApiResponse(
		HTTP.TOO_MANY_REQUESTS,
		'MANAGER_PAUSED',
		'Deleting is paused for you in this workspace: too much was deleted too fast. The owner has been told and can release it.',
	);

export function velocityBrake(
	store: IStoreAdapter,
	kind: string,
	options: IVelocityBrakeOptions | false = {},
	bus?: Bus,
): Middleware {
	if (options === false) return (_ctx, next) => next();
	const limit = options.limit ?? VELOCITY_BRAKE_DEFAULTS.limit;
	const windowMinutes = options.windowMinutes ?? VELOCITY_BRAKE_DEFAULTS.windowMinutes;

	return async (ctx: IFonderieContext, next) => {
		const ws = ctx.workspace as { id: string; ownerId?: string } | undefined;
		const actor = ctx.user?.id;
		if (!ws || !actor || ws.ownerId === actor) return next();

		// Paused already, or this would go over: brake now (once — the insert
		// claims it, so two racing requests send one notice).
		const [state] = await store.query<{ paused: boolean; recent: number }>(
			`SELECT EXISTS (SELECT 1 FROM fonderie_workspace_brakes WHERE workspace_id = $1 AND user_id = $2) AS paused,
			        (SELECT COUNT(*)::int FROM fonderie_workspace_destructive_actions
			          WHERE workspace_id = $1 AND actor_id = $2 AND created_at > now() - make_interval(mins => $3)) AS recent`,
			[ws.id, actor, windowMinutes],
		);
		if (state?.paused) return paused();
		if ((state?.recent ?? 0) >= limit) {
			const braked = await store.query(
				`INSERT INTO fonderie_workspace_brakes (workspace_id, user_id, actions) VALUES ($1, $2, $3)
				 ON CONFLICT DO NOTHING RETURNING user_id`,
				[ws.id, actor, state!.recent],
			);
			if (braked.length > 0) {
				const requestId = ctx.meta['requestId'] as string | undefined;
				await background(
					bus?.emit(
						EVENT_KEYS.managerPaused,
						{ workspaceId: ws.id, userId: null, targetUserId: actor, actions: state!.recent, windowMinutes },
						requestId !== undefined ? { requestId } : undefined,
					),
				);
			}
			return paused();
		}

		const res = await next();
		if (res.status >= 200 && res.status < 300) {
			// Counted, and the actor's rows older than a day pruned, in one statement.
			await store.query(
				`WITH pruned AS (
				   DELETE FROM fonderie_workspace_destructive_actions
				   WHERE workspace_id = $1 AND actor_id = $2 AND created_at < now() - interval '1 day'
				 )
				 INSERT INTO fonderie_workspace_destructive_actions (workspace_id, actor_id, kind) VALUES ($1, $2, $3)`,
				[ws.id, actor, kind],
			);
		}
		return res;
	};
}

/** The owner lets a paused person delete again (their count starts over). */
export async function releaseBrake(store: IStoreAdapter, workspaceId: string, userId: string): Promise<boolean> {
	const [row] = await store.query<{ released: boolean }>(
		`WITH released AS (
		   DELETE FROM fonderie_workspace_brakes WHERE workspace_id = $1 AND user_id = $2 RETURNING user_id
		 ), reset AS (
		   DELETE FROM fonderie_workspace_destructive_actions
		   WHERE workspace_id = $1 AND actor_id = $2 AND EXISTS (SELECT 1 FROM released)
		 )
		 SELECT EXISTS (SELECT 1 FROM released) AS released`,
		[workspaceId, userId],
	);
	return row?.released === true;
}
