import type { IFonderieContext, Middleware, Operation } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import { requireAuth, validate } from '@fonderie/core/middlewares';

import {
	noteSchema,
	addTagSchema,
	addEmailSchema,
	addPhoneSchema,
	blacklistSchema,
	addAddressSchema,
	updateEmailSchema,
	updatePhoneSchema,
	updateAddressSchema,
	createCustomerSchema,
	updateCustomerSchema,
	addRelationshipSchema,
} from './schemas';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';
import { velocityBrake, withWorkspace } from '@fonderie/workspaces';

import type { ICustomersConfig } from './config';
import { customerController } from './controllers/customer.controller';
import { customerAddressController } from './controllers/customer-address.controller';
import { customerEmailController } from './controllers/customer-email.controller';
import { customerNoteController } from './controllers/customer-note.controller';
import { customerPhoneController } from './controllers/customer-phone.controller';
import { customerTagController } from './controllers/customer-tag.controller';
import { customerLabelController } from './controllers/customer-label.controller';
import { customerBinController } from './controllers/customer-bin.controller';
import { customerRelationshipController } from './controllers/customer-relationship.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildCustomerRoutes(
	store: IStoreAdapter,
	config: ICustomersConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const wsCtx = withWorkspace(store);

	const customer = customerController(store, config, bus);
	const email = customerEmailController(store);
	const phone = customerPhoneController(store);
	const address = customerAddressController(store);
	const note = customerNoteController(store);
	const tag = customerTagController(store);
	const relationship = customerRelationshipController(store);
	const label = customerLabelController(store);
	const bin = customerBinController(store);

	const routes: RouteDefinition[] = [
		// ── Labels ───────────────────────────────────────────────────────
		['GET',    '/customers/labels',            requireAuth, wsCtx, label.list],
		['DELETE', '/customers/labels/:labelId',   requireAuth, wsCtx, label.remove],

		// ── The undo bin — BEFORE /customers/:customerId (the router is first-match)
		['GET',    '/customers/bin',                     requireAuth, wsCtx, bin.list],
		['POST',   '/customers/bin/:customerId/restore', requireAuth, wsCtx, bin.restore],
		['DELETE', '/customers/bin/:customerId',         requireAuth, wsCtx, bin.purge],

		// ── Core customer CRUD ───────────────────────────────────────────
		['GET', '/customers', requireAuth, wsCtx, customer.list],
		['POST', '/customers', requireAuth, wsCtx, validate(createCustomerSchema), customer.create],
		['GET', '/customers/:customerId', requireAuth, wsCtx, customer.get],
		['PUT', '/customers/:customerId', requireAuth, wsCtx, validate(updateCustomerSchema), customer.update],
		// Deleting too many too fast pauses the person (insider threat, Phase 5).
		['DELETE', '/customers/:customerId', requireAuth, wsCtx, velocityBrake(store, 'customer.delete', config.velocityBrake ?? {}, bus), customer.delete],
		['POST', '/customers/:customerId/blacklist', requireAuth, wsCtx, validate(blacklistSchema), customer.blacklist],
		['POST', '/customers/:customerId/unblacklist', requireAuth, wsCtx, customer.unblacklist],
		['POST', '/customers/:customerId/archive', requireAuth, wsCtx, customer.archive],
		['POST', '/customers/:customerId/unarchive', requireAuth, wsCtx, customer.unarchive],

		// ── Emails ───────────────────────────────────────────────────────
		['GET', '/customers/:customerId/emails', requireAuth, wsCtx, email.list],
		['POST', '/customers/:customerId/emails', requireAuth, wsCtx, validate(addEmailSchema), email.add],
		['PATCH', '/customers/:customerId/emails/:emailId', requireAuth, wsCtx, validate(updateEmailSchema), email.update],
		['PUT', '/customers/:customerId/emails/:emailId/primary', requireAuth, wsCtx, email.setPrimary],
		['DELETE', '/customers/:customerId/emails/:emailId', requireAuth, wsCtx, email.remove],

		// ── Phones ───────────────────────────────────────────────────────
		['GET', '/customers/:customerId/phones', requireAuth, wsCtx, phone.list],
		['POST', '/customers/:customerId/phones', requireAuth, wsCtx, validate(addPhoneSchema), phone.add],
		['PATCH', '/customers/:customerId/phones/:phoneId', requireAuth, wsCtx, validate(updatePhoneSchema), phone.update],
		['PUT', '/customers/:customerId/phones/:phoneId/primary', requireAuth, wsCtx, phone.setPrimary],
		['DELETE', '/customers/:customerId/phones/:phoneId', requireAuth, wsCtx, phone.remove],

		// ── Addresses ────────────────────────────────────────────────────
		['GET', '/customers/:customerId/addresses', requireAuth, wsCtx, address.list],
		['POST', '/customers/:customerId/addresses', requireAuth, wsCtx, validate(addAddressSchema), address.add],
		['PATCH', '/customers/:customerId/addresses/:addrId', requireAuth, wsCtx, validate(updateAddressSchema), address.update],
		['PUT', '/customers/:customerId/addresses/:addrId/primary', requireAuth, wsCtx, address.setPrimary],
		['DELETE', '/customers/:customerId/addresses/:addrId', requireAuth, wsCtx, address.remove],

		// ── Notes ────────────────────────────────────────────────────────
		['GET', '/customers/:customerId/notes', requireAuth, wsCtx, note.list],
		['POST', '/customers/:customerId/notes', requireAuth, wsCtx, validate(noteSchema), note.create],
		['PUT', '/customers/:customerId/notes/:noteId', requireAuth, wsCtx, validate(noteSchema), note.update],
		['DELETE', '/customers/:customerId/notes/:noteId', requireAuth, wsCtx, note.delete],

		// ── Tags ─────────────────────────────────────────────────────────
		['GET', '/customers/:customerId/tags', requireAuth, wsCtx, tag.list],
		['POST', '/customers/:customerId/tags', requireAuth, wsCtx, validate(addTagSchema), tag.add],
		['DELETE', '/customers/:customerId/tags/:tag', requireAuth, wsCtx, tag.remove],

		// ── Relationships ────────────────────────────────────────────────────
		['GET', '/customers/:customerId/relationships', requireAuth, wsCtx, relationship.list],
		['POST', '/customers/:customerId/relationships', requireAuth, wsCtx, validate(addRelationshipSchema), relationship.add],
		['PUT', '/customers/:customerId/relationships/:relatedId/primary', requireAuth, wsCtx, relationship.setPrimary],
		['DELETE', '/customers/:customerId/relationships/:relatedId', requireAuth, wsCtx, relationship.remove],
	];

	if (!config.permission) return routes;
	const key = config.permission;
	// The guard goes right after the workspace context it checks against.
	return routes.map(([method, path, ...mw]) => {
		const at = mw.indexOf(wsCtx) + 1;
		return [method, path, ...mw.slice(0, at), requireCustomerPermission(operationFor(method, path), key), ...mw.slice(at)];
	});
}

// GET reads; POST /customers creates; DELETE /customers/:id deletes; every
// other write changes a customer (or the workspace's labels) — update.
export function operationFor(method: string, path: string): Operation {
	if (method === 'GET') return 'read';
	if (method === 'POST' && path === '/customers') return 'create';
	if (method === 'DELETE' && path === '/customers/:customerId') return 'delete';
	// The bin: restoring brings a customer back; emptying one deletes for good.
	if (method === 'POST' && path === '/customers/bin/:customerId/restore') return 'create';
	if (method === 'DELETE' && path === '/customers/bin/:customerId') return 'delete';
	return 'update';
}

// @fonderie/permissions is not a dependency: its module puts its engine on
// every request. Read by shape; absent while a permission is configured →
// refuse (fail closed), exactly as requirePermission does.
function requireCustomerPermission(operation: Operation, key: string): Middleware {
	return async (ctx: IFonderieContext, next) => {
		if (!ctx.user) return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		const engine = ctx.meta['fonderie.permissions.engine'] as
			| { can?: (u: string, op: Operation, k: string, ws: string) => Promise<boolean> }
			| undefined;
		if (typeof engine?.can !== 'function') {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Permissions module not installed');
		}
		if (!ctx.workspace) return next(); // the controller answers 404
		if (!(await engine.can(ctx.user.id, operation, key, ctx.workspace.id))) {
			return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', `Permission denied: ${operation}:${key}`);
		}
		return next();
	};
}
