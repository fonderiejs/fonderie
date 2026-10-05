import type { Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAuth, validate } from '@fonderie/core/middlewares';
import { withBody } from '@fonderie/core/middlewares';
import * as workspaces from '@fonderie/workspaces';
import { requireManager, withWorkspace } from '@fonderie/workspaces';

import { createEndpointSchema, updateEndpointSchema } from './schemas';
import { requireStepUp } from './middlewares/require-step-up';
import { WEBHOOK_EVENTS, hostOf, webhookTrail } from './middlewares/trail';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import { EndpointModel } from './models/endpoint.model';
import { DeliveryModel } from './models/delivery.model';
import { WebhookDispatcher } from './dispatcher';
import { generateSecret, signPayload } from './signing';
import { toBinnedEndpointDTO, toEndpointDTO, toEndpointCreatedDTO, toDeliveryDTO } from './dtos/webhook';
import type { IWebhooksConfig } from './config';
import { assertPublicHttpUrl, pinnedTransport, SsrfError } from './ssrf';

type Route = [string, string, ...Middleware[]];

export function buildWebhookRoutes(store: IStoreAdapter, config: IWebhooksConfig = {}, bus?: EventBus): Route[] {
	// Every route needs the caller's workspace (endpoints are owned by one) —
	// withWorkspace resolves it from X-Workspace-ID (or the personal workspace)
	// and verifies membership. Without it ctx.workspace was always null and
	// every route answered 422 MISSING_WORKSPACE.
	const ws = withWorkspace(store);
	// Webhooks are integration settings: an endpoint receives every event of
	// the workspace and its secret signs them. Owner or manager roles only,
	// with the same knobs as @fonderie/workspaces (management: 'any-member'
	// restores open access for flat teams).
	const manager = requireManager(store, {
		...(config.management ? { management: config.management } : {}),
		...(config.managerRoles ? { managerRoles: config.managerRoles } : {}),
	});
	const stepUp = config.stepUp === false ? ((_c, next) => next()) as Middleware : requireStepUp();
	// Pointing an endpoint at another URL is the same move as creating one.
	const stepUpOnUrl = config.stepUp === false
		? ((_c, next) => next()) as Middleware
		: requireStepUp((ctx) => (ctx.meta['body'] as { url?: unknown } | undefined)?.url !== undefined);
	return [
		[
			'POST',
			'/webhooks',
			requireAuth,
			ws,
			manager,
			// A new endpoint receives EVERY event of the workspace — a live copy of
			// the business. It asks for a fresh proof it's the person (Phase 4).
			stepUp,
			validate(createEndpointSchema),
			withBody,
			webhookTrail(bus, WEBHOOK_EVENTS.endpointCreated, (_c, r) => ({ endpointId: r?.['id'] as string | undefined, host: hostOf(r?.['url']) })),
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

				// Reject internal / non-public targets at registration (fail fast).
				// Delivery re-validates too, since DNS can change afterward.
				try {
					await assertPublicHttpUrl(body.url);
				} catch (err) {
					if (err instanceof SsrfError)
						return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_URL', err.message);
					throw err;
				}

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
			ws,
			manager,
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

		// ── The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3) ─────────────
		// Registered BEFORE /webhooks/:endpointId: the router is first-match.
		[
			'GET',
			'/webhooks/bin',
			requireAuth,
			ws,
			manager,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required');
				const rows = await new EndpointModel(store).listBin(ctx.workspace.id);
				return setApiResponse(HTTP.OK, 'WEBHOOK_BIN', 'Deleted webhook endpoints.', { endpoints: rows.map(toBinnedEndpointDTO) });
			},
		],
		[
			'POST',
			'/webhooks/bin/:endpointId/restore',
			requireAuth,
			ws,
			manager,
			webhookTrail(bus, WEBHOOK_EVENTS.endpointRestored, (c) => ({ endpointId: (c.meta['params'] as Record<string, string>)['endpointId'] })),
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required');
				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				const restored = await new EndpointModel(store).restore(endpointId, ctx.workspace.id);
				if (!restored)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Nothing to restore: not deleted here, or deleted too long ago.');
				return setApiResponse(HTTP.OK, 'WEBHOOK_RESTORED', 'Webhook endpoint restored.', toEndpointDTO(restored));
			},
		],
		// Gone for good: the OWNER only — a manager who could empty the bin could
		// delete and then erase the undo.
		[
			'DELETE',
			'/webhooks/bin/:endpointId',
			requireAuth,
			ws,
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(HTTP.UNPROCESSABLE, 'MISSING_WORKSPACE', 'Workspace context required');
				if ((ctx.workspace as { ownerId?: string }).ownerId !== ctx.user?.id)
					return setApiResponse(HTTP.FORBIDDEN, 'OWNER_REQUIRED', 'Only the workspace owner can empty the bin.');
				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				if (!(await new EndpointModel(store).purgeFromBin(endpointId, ctx.workspace.id)))
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_IN_BIN', 'Not in the bin.');
				return new Response(null, { status: HTTP.NO_CONTENT });
			},
		],
		[
			'GET',
			'/webhooks/:endpointId',
			requireAuth,
			ws,
			manager,
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
			ws,
			manager,
			validate(updateEndpointSchema),
			stepUpOnUrl,
			withBody,
			webhookTrail(bus, WEBHOOK_EVENTS.endpointUpdated, (c) => ({ endpointId: (c.meta['params'] as Record<string, string>)['endpointId'], host: hostOf((c.meta['body'] as { url?: unknown } | undefined)?.url) })),
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
				if (body?.url !== undefined) {
					try {
						await assertPublicHttpUrl(body.url);
					} catch (err) {
						if (err instanceof SsrfError)
							return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_URL', err.message);
						throw err;
					}
					patch.url = body.url;
				}
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
			ws,
			manager,
			// Deleting too many too fast pauses the person (insider threat, Phase 5).
			// The velocity brake ships in @fonderie/workspaces 7.1; absent before.
			typeof workspaces.velocityBrake === 'function'
				? workspaces.velocityBrake(store, 'webhook.delete', config.velocityBrake ?? {})
				: ((_ctx, next) => next()) as Middleware,
			webhookTrail(bus, WEBHOOK_EVENTS.endpointDeleted, (c) => ({ endpointId: (c.meta['params'] as Record<string, string>)['endpointId'] })),
			async (ctx) => {
				if (!ctx.workspace)
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'MISSING_WORKSPACE',
						'Workspace context required',
					);

				const { endpointId } = ctx.meta['params'] as { endpointId: string };
				// Into the undo bin: restorable for 30 days.
				const deleted = await new EndpointModel(store).delete(endpointId, ctx.workspace.id, ctx.user?.id ?? null);
				if (!deleted)
					return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Webhook endpoint not found');

				return new Response(null, { status: HTTP.NO_CONTENT });
			},
		],

		[
			'GET',
			'/webhooks/:endpointId/deliveries',
			requireAuth,
			ws,
			manager,
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
			ws,
			manager,
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
					// SSRF-safe, DNS-pinned transport: re-validates the stored URL,
					// pins the socket to the validated IP (a rebind can't reach an
					// internal address), and never follows redirects.
					const res = await pinnedTransport(endpoint.url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-Webhook-Signature': signPayload(endpoint.secret, body),
							'X-Webhook-Event': 'webhook.test',
						},
						body,
						timeoutMs: 10_000,
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
