import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { UsageModel } from '../models/usage.model';
import type { IBillingConfig } from '../config';
import type { IBillingContext } from '../types';
import { parseWindowMs, resolveSubscriber } from '../utils';

export function usageController(store: IStoreAdapter, config?: IBillingConfig) {
	const usage = new UsageModel(store);

	return {
		async record(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const metric = body?.['metric'];
			const quantity = body?.['quantity'];
			const subscriber = resolveSubscriber(ctx);

			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}
			if (typeof metric !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'metric is required');
			}

			await usage.record({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				metric,
				quantity: typeof quantity === 'number' ? quantity : 1,
			});
			return setApiResponse(HTTP.OK, 'USAGE_RECORDED', 'Usage recorded successfully.');
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const metric = params?.['metric'];
			const subscriber = resolveSubscriber(ctx);

			if (!subscriber || !metric) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'subscriber and metric are required',
				);
			}

			// A windowed policy limit ('api-calls': { limit, window: '1d' }) is a
			// counter withBilling keeps on every request — not usage records — so
			// answer from the live counter it computed for THIS request (which it
			// therefore includes). Without this, a usage screen could not show the
			// rate limit at all: the records sum is always 0 for such a metric.
			const billing = ctx.meta['billing'] as IBillingContext | undefined;
			const status = billing?.statuses[metric];
			const entry = config?.plans.find((p) => p.name === billing?.plan)?.policy?.[metric];
			if (status?.type === 'counter' && entry && !('enabled' in entry) && entry.window) {
				const windowMs = parseWindowMs(entry.window);
				const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
				return setApiResponse(HTTP.OK, 'USAGE_FETCHED', 'Usage retrieved successfully.', {
					metric,
					kind: 'counter',
					total: status.used,
					since: new Date(windowStart).toISOString(),
					limit: status.limit,
					status: status.status,
					window: entry.window,
					resetsAt: status.resetsAt,
				});
			}

			const since = new Date();
			since.setDate(1);
			since.setHours(0, 0, 0, 0);

			const total = await usage.get(subscriber.type, subscriber.id, metric, since);
			// A policy limit without a window (e.g. 'jobs') is advertised alongside
			// the recorded total; the app owns what "used" means for it.
			const limit = entry && !('enabled' in entry) ? entry.limit : null;
			return setApiResponse(HTTP.OK, 'USAGE_FETCHED', 'Usage retrieved successfully.', {
				metric,
				kind: 'records',
				total,
				// Explicit ISO — the client's IUsageResult.since promises a string.
				since: since.toISOString(),
				limit,
				status: null,
				window: null,
				resetsAt: null,
			});
		},
	};
}
