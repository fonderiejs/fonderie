import type { IFonderieContext, Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAdminToken } from '@fonderie/core/middlewares';
import { VersionConflictError } from '@fonderie/store';
import type { IStoreAdapter } from '@fonderie/store';

import {
	setTemplate,
	rollbackTemplate,
	listTemplateRevisions,
	getTemplateEntry,
	listTemplateEntries,
	deleteTemplate,
} from './admin';

// Bearer-token guard (mirrors @fonderie/config's admin surface). Only registered
// when a token is configured — no token, no exposed template admin routes.
// Wrap a handler in the shared admin-token guard (@fonderie/core/middlewares) —
// one constant-time Bearer check across billing/config/courier.
function guarded(adminToken: string, handler: Middleware): Middleware {
	const guard = requireAdminToken(adminToken);
	return (ctx, next) => guard(ctx, () => handler(ctx, next));
}

const actorOf = (ctx: IFonderieContext) => ctx.request.headers.get('x-actor') || 'admin-token';
const typeOf = (ctx: IFonderieContext) => ctx.meta.params?.['type'] ?? '';
const localeOf = (ctx: IFonderieContext): string | null =>
	new URL(ctx.request.url).searchParams.get('locale');
const body = (ctx: IFonderieContext): Record<string, unknown> =>
	(ctx.meta['body'] as Record<string, unknown> | undefined) ?? {};

function conflictOr(err: unknown): Response {
	if (err instanceof VersionConflictError) {
		return setApiResponse(HTTP.CONFLICT, 'VERSION_CONFLICT', err.message, {
			currentVersion: err.currentVersion,
		});
	}
	throw err;
}

// Build the template admin route table (registered by CourierModule.install when
// an adminToken is configured).
export function buildTemplateAdminRoutes(
	store: IStoreAdapter,
	adminToken: string,
): Array<[string, string, Middleware]> {
	const g = (h: Middleware): Middleware => guarded(adminToken, h);

	return [
		['GET', '/admin/templates', g(async () => {
			return setApiResponse(HTTP.OK, 'TEMPLATES_LISTED', 'Templates', await listTemplateEntries(store));
		})],
		['GET', '/admin/templates/:type', g(async (ctx) => {
			const row = await getTemplateEntry(typeOf(ctx), localeOf(ctx), store);
			return row
				? setApiResponse(HTTP.OK, 'TEMPLATE', 'Template', row)
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such template');
		})],
		['PUT', '/admin/templates/:type', g(async (ctx) => {
			const b = body(ctx);
			if (typeof b['text'] !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required');
			}
			try {
				const opts: Parameters<typeof setTemplate>[0] = {
					type: typeOf(ctx),
					text: b['text'],
					locale: localeOf(ctx),
					actor: actorOf(ctx),
				};
				if (typeof b['subject'] === 'string') opts.subject = b['subject'];
				if (typeof b['html'] === 'string') opts.html = b['html'];
				if (typeof b['active'] === 'boolean') opts.active = b['active'];
				if (typeof b['ifVersion'] === 'number') opts.ifVersion = b['ifVersion'];
				return setApiResponse(HTTP.OK, 'TEMPLATE_SET', 'Template saved', await setTemplate(opts, store));
			} catch (err) {
				return conflictOr(err);
			}
		})],
		['DELETE', '/admin/templates/:type', g(async (ctx) => {
			const ok = await deleteTemplate(typeOf(ctx), localeOf(ctx), store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such template');
		})],
		['GET', '/admin/templates/:type/revisions', g(async (ctx) => {
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Template revisions', await listTemplateRevisions(typeOf(ctx), localeOf(ctx), store));
		})],
		['POST', '/admin/templates/:type/rollback', g(async (ctx) => {
			const b = body(ctx);
			const toVersion = Number(b['toVersion']);
			if (!Number.isInteger(toVersion)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.toVersion (int) is required');
			}
			const row = await rollbackTemplate(
				{ type: typeOf(ctx), locale: localeOf(ctx), toVersion, actor: actorOf(ctx) },
				store,
			);
			return setApiResponse(HTTP.OK, 'ROLLED_BACK', `Rolled back to v${toVersion}`, row);
		})],
	];
}
