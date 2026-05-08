import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { recordUsage, getUsage } from '../services/usage';

export function recordUsageHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body     = ctx.meta['body'] as Record<string, unknown> | undefined
		const metric   = body?.['metric'];
		const quantity = body?.['quantity'];

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		if (typeof metric !== 'string') {
			return Response.json({ error: 'metric is required' }, { status: 422 });
		}

		const qty = typeof quantity === 'number' ? quantity : 1;

		await recordUsage({ workspaceId, metric, quantity: qty }, store);

		return Response.json({ ok: true });
	}
}

export function getUsageHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = ctx.workspace?.id ?? params?.['workspaceId'];
		const metric      = params?.['metric']

		if (!workspaceId || !metric) {
			return Response.json({ error: 'workspaceId and metric are required' }, { status: 422 });
		}

		const since = new Date();
		since.setDate(1);  // start of current month
		since.setHours(0, 0, 0, 0);

		const total = await getUsage(workspaceId, metric, since, store);
		return Response.json({ metric, total, since });
	}
}
