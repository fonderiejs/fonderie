import type { IFonderieContext } from '@fonderie-js/core'
import type { SubscriberType }   from './types'

export interface ISubscriber {
	type: SubscriberType
	id:   string
}

// Converts window strings like '1d', '30d', '1h' to milliseconds.
export function parseWindowMs(window: string): number {
	const n    = parseInt(window, 10)
	const unit = window.slice(String(n).length)
	switch (unit) {
		case 'h': return n * 3_600_000
		case 'd': return n * 86_400_000
		case 'm': return n * 60_000
		default:  throw new Error(`Unknown window unit: '${unit}' in '${window}'`)
	}
}

// Resolves billing subscriber from request context.
// Works in both global middleware (before router sets params) and route handlers.
// Precedence: path params → URL path parsing → ctx.workspace → ctx.user
export function resolveSubscriber(ctx: IFonderieContext): ISubscriber | null {
	// Available in route handlers (after router runs)
	const params      = ctx.meta['params'] as Record<string, string> | undefined
	const wsFromParam = params?.['workspaceId']
	if (wsFromParam) return { type: 'workspace', id: wsFromParam }

	// Available in global middleware (before router runs) — parse from URL
	const url        = new URL(ctx.request.url)
	const wsFromUrl  = url.pathname.match(/\/workspaces\/([^/]+)/)?.[1]
	if (wsFromUrl)  return { type: 'workspace', id: wsFromUrl }

	if (ctx.workspace?.id) return { type: 'workspace', id: ctx.workspace.id }
	if (ctx.user?.id)      return { type: 'user',      id: ctx.user.id     }
	return null
}
