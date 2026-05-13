import { setApiResponse, HTTP } from '@fonderie-js/core'
import type { IStoreAdapter }   from '@fonderie-js/store'
import type { Middleware }       from '@fonderie-js/core'
import { requireAuth }           from '@fonderie-js/core/middlewares'

import type { IBillingConfig }    from './config'
import { planController }         from './controllers/plan.controller'
import { subscriptionController } from './controllers/subscription.controller'
import { checkoutController }     from './controllers/checkout.controller'
import { usageController }        from './controllers/usage.controller'
import { webhookController }      from './controllers/webhook.controller'

type RouteDefinition = [string, string, ...Middleware[]]

// Guards workspace billing routes by verifying the requesting user
// is an active member of the workspace. Uses a direct DB query to
// avoid a circular dependency on @fonderie-js/workspaces.
function requireWorkspaceMember(store: IStoreAdapter): Middleware {
	return async (ctx, next) => {
		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = params?.['workspaceId']

		if (!workspaceId || !ctx.user?.id) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized')
		}

		const rows = await store.query<{ user_id: string }>(
			`SELECT user_id FROM fonderie_role_user_workspaces
			 WHERE workspace_id = $1 AND user_id = $2 AND removed = false AND suspended = false
			 LIMIT 1`,
			[workspaceId, ctx.user.id],
		)

		if (rows.length === 0) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Not a member of this workspace')
		}

		return next()
	}
}

export function buildBillingRoutes(
	store:  IStoreAdapter,
	config: IBillingConfig,
): RouteDefinition[] {
	const plan         = planController(store)
	const subscription = subscriptionController(store)
	const checkout     = checkoutController(store, config)
	const usage        = usageController(store)
	const webhook      = webhookController(store, config)
	const wsMember     = requireWorkspaceMember(store)

	return [
		// Plans — public read-only
		['GET', '/plans',         plan.list],
		['GET', '/plans/:planId', plan.get],

		// User-level billing
		['GET',  '/billing/subscription',  requireAuth, subscription.get],
		['POST', '/billing/checkout',      requireAuth, checkout.createSession],
		['POST', '/billing/portal',        requireAuth, checkout.createPortal],
		['POST', '/billing/usage',         requireAuth, usage.record],
		['GET',  '/billing/usage/:metric', requireAuth, usage.get],

		// Workspace-level billing — membership verified before any billing logic
		['GET',  '/workspaces/:workspaceId/billing/subscription',  requireAuth, wsMember, subscription.get],
		['POST', '/workspaces/:workspaceId/billing/checkout',      requireAuth, wsMember, checkout.createSession],
		['POST', '/workspaces/:workspaceId/billing/portal',        requireAuth, wsMember, checkout.createPortal],
		['POST', '/workspaces/:workspaceId/billing/usage',         requireAuth, wsMember, usage.record],
		['GET',  '/workspaces/:workspaceId/billing/usage/:metric', requireAuth, wsMember, usage.get],

		// Webhook — signature verified inside the handler
		['POST', '/billing/webhook', webhook.handle],
	]
}
