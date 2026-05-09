import { setSuccessResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { UsageModel } from '../models/usage.model';

export function usageController(store: IStoreAdapter) {
	const usage = new UsageModel(store)

	return {
		async record(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user) return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

			const body     = ctx.meta['body'] as Record<string, unknown> | undefined
			const metric   = body?.['metric']
			const quantity = body?.['quantity']

			const workspaceId = ctx.workspace?.id ??
				(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

			if (!workspaceId) {
				return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required')
			}
			if (typeof metric !== 'string') {
				return setErrorResponse(422, 'INVALID_PARAMETER', 'metric is required')
			}

			await usage.record({ workspaceId, metric, quantity: typeof quantity === 'number' ? quantity : 1 })
			return setSuccessResponse(200, 'USAGE_RECORDED', 'Usage recorded successfully.')
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user) return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

			const params      = ctx.meta['params'] as Record<string, string> | undefined
			const workspaceId = ctx.workspace?.id ?? params?.['workspaceId']
			const metric      = params?.['metric']

			if (!workspaceId || !metric) {
				return setErrorResponse(422, 'INVALID_PARAMETER', 'workspaceId and metric are required')
			}

			const since = new Date()
			since.setDate(1)
			since.setHours(0, 0, 0, 0)

			const total = await usage.get(workspaceId, metric, since)
			return setSuccessResponse(200, 'USAGE_FETCHED', 'Usage retrieved successfully.', { metric, total, since })
		},
	}
}
