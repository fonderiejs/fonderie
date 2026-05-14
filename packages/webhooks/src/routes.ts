import type { Middleware } from '@fonderie-js/core';
import { setApiResponse, HTTP } from '@fonderie-js/core';
import { requireAuth } from '@fonderie-js/core/middlewares';
import { withBody } from '@fonderie-js/core/middlewares';
import type { IStoreAdapter } from '@fonderie-js/store';

import { EndpointModel } from './models/endpoint.model';
import { DeliveryModel } from './models/delivery.model';
import { WebhookDispatcher } from './dispatcher';
import { generateSecret, signPayload } from './signing';
import { toEndpointDTO, toEndpointCreatedDTO, toDeliveryDTO } from './dtos/webhook';
import type { IWebhooksConfig } from './config';

type Route = [string, string, ...Middleware[]];

export function buildWebhookRoutes(store: IStoreAdapter, config: IWebhooksConfig = {}): Route[] {
	return [
		[
			'POST',
			'/webhooks',
			requireAuth,
			withBody,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const body = ctx.meta['body'] as { url?: string; events?: string[] } | undefined;
				if (!body?.url)
					return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_FIELD', 'url is required');

				const endpoint = await new EndpointModel(store).create({
					workspaceId: ctx.workspace.id,
					url: body.url,
					secret: generateSecret(),
					events: body.events ?? [],
				});

				return setApiResponse(
					HTTP.CREATED,
					'WEBHOOK_CREATED',
					'Webhook endpoint registered.',
					toEndpointCreatedDTO(endpoint),
				);
			},
		],

		[
			'GET',
			'/webhooks',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const list = await new EndpointModel(store).list(ctx.workspace.id);
				return setApiResponse(HTTP.OK, 'WEBHOOKS_FETCHED', 'Webhook endpoints retrieved.', {
					endpoints: list.map(toEndpointDTO),
				});
			},
		],

		[
			'GET',
			'/webhooks/:endpointId',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id);
				if (!endpoint)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				return setApiResponse(
					HTTP.OK,
					'WEBHOOK_FETCHED',
					'Webhook endpoint retrieved.',
					toEndpointDTO(endpoint),
				);
			},
		],

		[
			'PATCH',
			'/webhooks/:endpointId',
			requireAuth,
			withBody,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const body = ctx.meta['body'] as
					| { url?: string; events?: string[]; enabled?: boolean }
					| undefined;

				const patch: { url?: string; events?: string[]; enabled?: boolean } = {};
				if (body?.url !== undefined) patch.url = body.url;
				if (body?.events !== undefined) patch.events = body.events;
				if (body?.enabled !== undefined) patch.enabled = body.enabled;

				const updated = await new EndpointModel(store).update(endpointId, ctx.workspace.id, patch);
				if (!updated)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				return setApiResponse(
					HTTP.OK,
					'WEBHOOK_UPDATED',
					'Webhook endpoint updated.',
					toEndpointDTO(updated),
				);
			},
		],

		[
			'DELETE',
			'/webhooks/:endpointId',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const deleted = await new EndpointModel(store).delete(endpointId, ctx.workspace.id);
				if (!deleted)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				return new Response(null, { status: HTTP.NO_CONTENT });
			},
		],

		[
			'GET',
			'/webhooks/:endpointId/deliveries',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id);
				if (!endpoint)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				const list = await new DeliveryModel(store).listByEndpoint(endpointId);
				return setApiResponse(HTTP.OK, 'DELIVERIES_FETCHED', 'Deliveries retrieved.', {
					deliveries: list.map(toDeliveryDTO),
				});
			},
		],

		[
			'POST',
			'/webhooks/:endpointId/test',
			requireAuth,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const endpoint = await new EndpointModel(store).findById(endpointId, ctx.workspace.id);
				if (!endpoint)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				const body = JSON.stringify({
					id: `test-${Date.now()}`,
					type: 'webhook.test',
					data: { workspaceId: ctx.workspace.id, message: 'Test webhook delivery.' },
				});

				try {
					const res = await fetch(endpoint.url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Webhook-Signature': signPayload(endpoint.secret, body),
							'X-Webhook-Event': 'webhook.test',
						},
						body,
						signal: AbortSignal.timeout(10_000),
					});

					return setApiResponse(HTTP.OK, 'TEST_SENT', 'Test delivery attempted.', {
						status: res.status,
						ok: res.ok,
					});
				} catch (err) {
					return setApiResponse(HTTP.OK, 'TEST_SENT', 'Test delivery attempted.', {
						status: null,
						ok: false,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			},
		],
	];
}
