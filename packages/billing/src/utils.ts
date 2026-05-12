import type { IFonderieContext } from '@fonderie-js/core';
import type { SubscriberType }   from './types';

export interface ISubscriber {
	type: SubscriberType
	id:   string
}

/**
 * Resolves the billing subscriber from request context.
 * Workspace routes (/workspaces/:workspaceId/...) resolve as 'workspace'.
 * User routes (/billing/...) resolve as 'user' via ctx.user.
 */
export function resolveSubscriber(ctx: IFonderieContext): ISubscriber | null {
	const params      = ctx.meta['params'] as Record<string, string> | undefined
	const workspaceId = params?.['workspaceId'] ?? ctx.workspace?.id
	if (workspaceId) return { type: 'workspace', id: workspaceId }
	if (ctx.user?.id) return { type: 'user',      id: ctx.user.id  }
	return null
}
