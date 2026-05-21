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
import { customerLabelController } from './controllers/customer-label.controller';
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

	return [
		// ── Labels ───────────────────────────────────────────────────────
		['GET',    '/customers/labels',            requireAuth, wsCtx, label.list],
		['DELETE', '/customers/labels/:labelId',   requireAuth, wsCtx, label.remove],

		// ── Core customer CRUD ───────────────────────────────────────────
		['GET', '/customers', requireAuth, wsCtx, customer.list],
		['POST', '/customers', requireAuth, wsCtx, customer.create],
		['GET', '/customers/:customerId', requireAuth, wsCtx, customer.get],
		['PUT', '/customers/:customerId', requireAuth, wsCtx, customer.update],
		['DELETE', '/customers/:customerId', requireAuth, wsCtx, customer.delete],
		['POST', '/customers/:customerId/blacklist', requireAuth, wsCtx, customer.blacklist],
		['POST', '/customers/:customerId/unblacklist', requireAuth, wsCtx, customer.unblacklist],

		// ── Emails ───────────────────────────────────────────────────────
		['GET', '/customers/:customerId/emails', requireAuth, wsCtx, email.list],
		['POST', '/customers/:customerId/emails', requireAuth, wsCtx, email.add],
		['PATCH', '/customers/:customerId/emails/:emailId', requireAuth, wsCtx, email.update],
		['PUT', '/customers/:customerId/emails/:emailId/primary', requireAuth, wsCtx, email.setPrimary],
		['DELETE', '/customers/:customerId/emails/:emailId', requireAuth, wsCtx, email.remove],

		// ── Phones ───────────────────────────────────────────────────────
		['GET', '/customers/:customerId/phones', requireAuth, wsCtx, phone.list],
		['POST', '/customers/:customerId/phones', requireAuth, wsCtx, phone.add],
		['PATCH', '/customers/:customerId/phones/:phoneId', requireAuth, wsCtx, phone.update],
		['PUT', '/customers/:customerId/phones/:phoneId/primary', requireAuth, wsCtx, phone.setPrimary],
		['DELETE', '/customers/:customerId/phones/:phoneId', requireAuth, wsCtx, phone.remove],

		// ── Addresses ────────────────────────────────────────────────────
		['GET', '/customers/:customerId/addresses', requireAuth, wsCtx, address.list],
		['POST', '/customers/:customerId/addresses', requireAuth, wsCtx, address.add],
		['PATCH', '/customers/:customerId/addresses/:addrId', requireAuth, wsCtx, address.update],
		['PUT', '/customers/:customerId/addresses/:addrId/primary', requireAuth, wsCtx, address.setPrimary],
		['DELETE', '/customers/:customerId/addresses/:addrId', requireAuth, wsCtx, address.remove],

		// ── Notes ────────────────────────────────────────────────────────
		['GET', '/customers/:customerId/notes', requireAuth, wsCtx, note.list],
		['POST', '/customers/:customerId/notes', requireAuth, wsCtx, note.create],
		['PUT', '/customers/:customerId/notes/:noteId', requireAuth, wsCtx, note.update],
		['DELETE', '/customers/:customerId/notes/:noteId', requireAuth, wsCtx, note.delete],

		// ── Tags ─────────────────────────────────────────────────────────
		['GET', '/customers/:customerId/tags', requireAuth, wsCtx, tag.list],
		['POST', '/customers/:customerId/tags', requireAuth, wsCtx, tag.add],
		['DELETE', '/customers/:customerId/tags/:tag', requireAuth, wsCtx, tag.remove],

		// ── Relationships ────────────────────────────────────────────────────
		['GET', '/customers/:customerId/relationships', requireAuth, wsCtx, relationship.list],
		['POST', '/customers/:customerId/relationships', requireAuth, wsCtx, relationship.add],
		['PUT', '/customers/:customerId/relationships/:relatedId/primary', requireAuth, wsCtx, relationship.setPrimary],
		['DELETE', '/customers/:customerId/relationships/:relatedId', requireAuth, wsCtx, relationship.remove],
	];
}
