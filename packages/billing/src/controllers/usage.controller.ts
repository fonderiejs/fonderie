import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { UsageModel }        from '../models/usage.model';
import { resolveSubscriber } from '../utils';

export function usageController(store: IStoreAdapter) {
	const usage = new UsageModel(store)

	return {
		async record(ctx: IFonderieContext): Promise<Response> {
			const body       = ctx.meta['body'] as Record<string, unknown> | undefined
			const metric     = body?.['metric']
			const quantity   = body?.['quantity']
			const subscriber = resolveSubscriber(ctx)

			if (!subscriber) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required')
			}
			if (typeof metric !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'metric is required')
			}

			await usage.record({
				subscriberType: subscriber.type,
				subscriberId:   subscriber.id,
				metric,
				quantity: typeof quantity === 'number' ? quantity : 1,
			})
			return setApiResponse(HTTP.OK, 'USAGE_RECORDED', 'Usage recorded successfully.')
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const params     = ctx.meta['params'] as Record<string, string> | undefined
			const metric     = params?.['metric']
			const subscriber = resolveSubscriber(ctx)

			if (!subscriber || !metric) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'subscriber and metric are required')
			}

			const since = new Date()
			since.setDate(1)
			since.setHours(0, 0, 0, 0)

			const total = await usage.get(subscriber.type, subscriber.id, metric, since)
			return setApiResponse(HTTP.OK, 'USAGE_FETCHED', 'Usage retrieved successfully.', { metric, total, since })
		},
	}
}
