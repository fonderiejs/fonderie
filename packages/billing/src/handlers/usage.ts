import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { recordUsage, getUsage } from '../services/usage';

export function recordUsageHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const body     = ctx.meta['body'] as Record<string, unknown> | undefined
		const metric   = body?.['metric'];
		const quantity = body?.['quantity'];

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400);
		}

		if (typeof metric !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'metric is required', 422);
		}

		const qty = typeof quantity === 'number' ? quantity : 1;

		await recordUsage({ workspaceId, metric, quantity: qty }, store);

		return setApiResponse('USAGE_RECORDED', 'Usage recorded successfully.');
	}
}

export function getUsageHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = ctx.workspace?.id ?? params?.['workspaceId'];
		const metric      = params?.['metric']

		if (!workspaceId || !metric) {
			return setErrorResponse('INVALID_PARAMETER', 'workspaceId and metric are required', 422);
		}

		const since = new Date();
		since.setDate(1);
		since.setHours(0, 0, 0, 0);

		const total = await getUsage(workspaceId, metric, since, store);
		return setApiResponse('USAGE_FETCHED', 'Usage retrieved successfully.', { metric, total, since });
	}
}
