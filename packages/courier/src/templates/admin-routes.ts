import type { IAdminRoute, IFonderieContext, Middleware } from '@fonderie/core';
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
import { getLayoutHtml, renderFragment, templateVariables } from './resolver';

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

type RouteRow = [string, string, Middleware];

// What the route table needs from ICourierConfig. Only the preview reads it —
// every other handler is pure storage.
export interface ITemplateAdminOptions {
	brandName?: string;
}

// The legacy standalone surface (bare /admin/*, guarded by this module's own
// token). Registered by CourierModule.install when an adminToken is configured.
export function buildTemplateAdminRoutes(
	store: IStoreAdapter,
	adminToken: string,
	opts: ITemplateAdminOptions = {},
): RouteRow[] {
	return templateAdminRouteTable(store, opts).map(([m, p, h]) => [m, p, guarded(adminToken, h)]);
}

// The same handlers, unguarded and prefix-relative, for @fonderie/admin to mount
// under its own prefix behind its own token.
export function describeTemplateAdminRoutes(
	store: IStoreAdapter,
	opts: ITemplateAdminOptions = {},
): IAdminRoute[] {
	return templateAdminRouteTable(store, opts).map(([method, path, h]) => ({
		method,
		path: path.replace(/^\/admin/, ''),
		handlers: [h],
	}));
}

function templateAdminRouteTable(store: IStoreAdapter, opts: ITemplateAdminOptions = {}): RouteRow[] {
	const brandName = opts.brandName;
	return [
		['GET', '/admin/templates', async () => {
			return setApiResponse(HTTP.OK, 'TEMPLATES_LISTED', 'Templates', await listTemplateEntries(store));
		}],
		['GET', '/admin/templates/:type', async (ctx) => {
			const row = await getTemplateEntry(typeOf(ctx), localeOf(ctx), store);
			return row
				? setApiResponse(HTTP.OK, 'TEMPLATE', 'Template', row)
				: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No such template');
		}],
		['PUT', '/admin/templates/:type', async (ctx) => {
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
		}],
		['DELETE', '/admin/templates/:type', async (ctx) => {
			const ok = await deleteTemplate(typeOf(ctx), localeOf(ctx), store);
			return setApiResponse(ok ? HTTP.OK : HTTP.NOT_FOUND, ok ? 'DELETED' : 'NOT_FOUND', ok ? 'Deleted' : 'No such template');
		}],
		['GET', '/admin/templates/:type/revisions', async (ctx) => {
			return setApiResponse(HTTP.OK, 'REVISIONS', 'Template revisions', await listTemplateRevisions(typeOf(ctx), localeOf(ctx), store));
		}],
		['POST', '/admin/templates/:type/rollback', async (ctx) => {
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
		}],
		// Renders what the editor is HOLDING, not what is stored — the point is
		// to see the change before saving it. Goes through renderFragment and the
		// operator's own _layout row, because a fragment rendered without the
		// shell looks nothing like the mail that sends, and a preview that lies
		// is worse than none.
		//
		// POST, so the scope derivation makes this `write`. Correct: the body is
		// arbitrary content handed to the renderer, and anyone in the editor
		// already needs `write` to save.
		['POST', '/admin/templates/:type/preview', async (ctx) => {
			const b = body(ctx);
			if (typeof b['text'] !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.text (string) is required');
			}
			const data = (b['data'] ?? {}) as Record<string, unknown>;
			if (typeof data !== 'object' || Array.isArray(data)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID', 'body.data must be an object');
			}
			const locale = localeOf(ctx);
			const html = typeof b['html'] === 'string' && b['html'] ? b['html'] : null;
			const rendered = renderFragment(
				{
					text: b['text'],
					...(typeof b['subject'] === 'string' ? { subject: b['subject'] } : {}),
					...(html ? { html } : {}),
				},
				// Only fetched when there is HTML to wrap, mirroring the resolver.
				html ? await getLayoutHtml(store, locale ?? undefined) : undefined,
				// brandName is merged by the Dispatcher on a real send, never by
				// the resolver — so without this the shell renders the default
				// brand and the preview quietly misreports it.
				{ ...(brandName ? { brandName } : {}), ...data },
			);
			// The variables THIS content uses, so an editor can offer exactly the
			// right fields without re-implementing the {{var}} contract on the
			// client — four copies of that regex already exist in this repo.
			return setApiResponse(HTTP.OK, 'TEMPLATE_PREVIEW', 'Rendered preview', {
				...rendered,
				variables: templateVariables(b['subject'] as string, b['text'], html),
			});
		}],
	];
}
