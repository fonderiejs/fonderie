import type { Middleware } from '@fonderie-js/core';
import { requireAuth } from '@fonderie-js/core/middlewares';
import type { EventBus } from '@fonderie-js/events';
import type { IStoreAdapter } from '@fonderie-js/store';
import { withWorkspace } from '@fonderie-js/workspaces';

import type { ICustomersConfig } from './config';
import { customerController } from './controllers/customer.controller';
import { customerAddressController } from './controllers/customer-address.controller';
import { customerEmailController } from './controllers/customer-email.controller';
import { customerNoteController } from './controllers/customer-note.controller';
import { customerPhoneController } from './controllers/customer-phone.controller';
import { customerTagController } from './controllers/customer-tag.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildCustomerRoutes(
	store: IStoreAdapter,
	_config: ICustomersConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const wsCtx = withWorkspace(store);

	const customer = customerController(store, bus);
	const email = customerEmailController(store);
	const phone = customerPhoneController(store);
	const address = customerAddressController(store);
	const note = customerNoteController(store);
	const tag = customerTagController(store);

	return [
		// ── Core customer CRUD ───────────────────────────────────────────
		['GET', '/customers', requireAuth, wsCtx, customer.list],
		['POST', '/customers', requireAuth, wsCtx, customer.create],
		['GET', '/customers/:id', requireAuth, wsCtx, customer.get],
		['PUT', '/customers/:id', requireAuth, wsCtx, customer.update],
		['DELETE', '/customers/:id', requireAuth, wsCtx, customer.delete],
		['POST', '/customers/:id/archive', requireAuth, wsCtx, customer.archive],
		['POST', '/customers/:id/restore', requireAuth, wsCtx, customer.restore],

		// ── Emails ───────────────────────────────────────────────────────
		['GET', '/customers/:id/emails', requireAuth, wsCtx, email.list],
		['POST', '/customers/:id/emails', requireAuth, wsCtx, email.add],
		['PUT', '/customers/:id/emails/:emailId/primary', requireAuth, wsCtx, email.setPrimary],
		['DELETE', '/customers/:id/emails/:emailId', requireAuth, wsCtx, email.remove],

		// ── Phones ───────────────────────────────────────────────────────
		['GET', '/customers/:id/phones', requireAuth, wsCtx, phone.list],
		['POST', '/customers/:id/phones', requireAuth, wsCtx, phone.add],
		['PUT', '/customers/:id/phones/:phoneId/primary', requireAuth, wsCtx, phone.setPrimary],
		['DELETE', '/customers/:id/phones/:phoneId', requireAuth, wsCtx, phone.remove],

		// ── Addresses ────────────────────────────────────────────────────
		['GET', '/customers/:id/addresses', requireAuth, wsCtx, address.list],
		['POST', '/customers/:id/addresses', requireAuth, wsCtx, address.add],
		['PUT', '/customers/:id/addresses/:addrId/primary', requireAuth, wsCtx, address.setPrimary],
		['DELETE', '/customers/:id/addresses/:addrId', requireAuth, wsCtx, address.remove],

		// ── Notes ────────────────────────────────────────────────────────
		['GET', '/customers/:id/notes', requireAuth, wsCtx, note.list],
		['POST', '/customers/:id/notes', requireAuth, wsCtx, note.create],
		['PUT', '/customers/:id/notes/:noteId', requireAuth, wsCtx, note.update],
		['DELETE', '/customers/:id/notes/:noteId', requireAuth, wsCtx, note.delete],

		// ── Tags ─────────────────────────────────────────────────────────
		['GET', '/customers/:id/tags', requireAuth, wsCtx, tag.list],
		['POST', '/customers/:id/tags', requireAuth, wsCtx, tag.add],
		['DELETE', '/customers/:id/tags/:tag', requireAuth, wsCtx, tag.remove],
	];
}
