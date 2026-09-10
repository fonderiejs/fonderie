import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import type { ITemplateResolver, ICourierMessage } from './types';
import type { ICourierConfig } from './config';

import { Dispatcher } from './dispatcher';
import { SmsChannel } from './channels/sms';
import { PushChannel } from './channels/push';
import { EmailChannel } from './channels/email';
import type { IReadinessProblem } from '@fonderie/core';
import { validateAdminToken } from '@fonderie/core/middlewares';
import { DBTemplateResolver, FSTemplateResolver, DefaultTemplates } from './templates/resolver';
import { validateCourierConfig, collectCourierConfigProblems } from './config-guard';
import { handleSendGridDelivery, handleMailgunDelivery, handleMailtrapDelivery } from './delivery';
import { buildTemplateAdminRoutes } from './templates/admin-routes';

export class CourierModule implements IFonderieModule {
	readonly name = '@fonderie/courier';
	readonly deps = ['@fonderie/events'];
	readonly dispatcher: Dispatcher;

	constructor(
		private config: ICourierConfig,
		private store?: IStoreAdapter,
		bus?: EventBus,
	) {
		const templateSource = config.templates?.source ?? 'db';
		const resolver = createTemplateResolver(templateSource, config, store);

		this.dispatcher = new Dispatcher(config, resolver, store);

		if (config.email) this.dispatcher.registerChannel(new EmailChannel(config.email));
		if (config.sms) this.dispatcher.registerChannel(new SmsChannel(config.sms));
		if (config.push) this.dispatcher.registerChannel(new PushChannel(config.push));

		bus?.on<ICourierMessage>(
			NOTIFICATION_EVENT,
			async (msg) => {
				await this.dispatcher.dispatch(msg);
			},
			'courier',
		);
	}

	// Report config problems for app.checkProductionReadiness() (data, not warn).
	checkReadiness(): IReadinessProblem[] {
		return [
			...collectCourierConfigProblems(this.config, this.dispatcher.channelNames()),
			// Shared admin-token strength rule (@fonderie/core/middlewares) — the
			// /admin/templates surface must not be guarded by a weak/placeholder token.
			...validateAdminToken(this.config.adminToken, { module: this.name }),
		];
	}

	install(app: IFonderieApp): void {
		// Boot-time preflight: warn if any routed message type has no provider.
		validateCourierConfig(this.config, this.dispatcher.channelNames());

		const store = this.store;
		const delivery = this.config.delivery;
		const signingKeys = delivery?.signingKeys;

		// Fail closed: a delivery route only exists when its verification key is
		// configured — an unverified endpoint would accept forged delivered/
		// opened/bounced events from anyone who finds the URL. (The handlers
		// also 401 without a key, as defense in depth.)
		if (signingKeys?.sendgrid) {
			app.addRoute('POST', '/courier/delivery/sendgrid', (ctx) =>
				handleSendGridDelivery(ctx.request, store!, signingKeys.sendgrid),
			);
		}
		if (signingKeys?.mailgun) {
			app.addRoute('POST', '/courier/delivery/mailgun', (ctx) =>
				handleMailgunDelivery(ctx.request, store!, signingKeys.mailgun),
			);
		}
		// Mailtrap has NO signature scheme — explicit dev/test opt-in only.
		if (delivery?.allowUnverifiedMailtrap) {
			app.addRoute('POST', '/courier/delivery/mailtrap', (ctx) =>
				handleMailtrapDelivery(ctx.request, store!),
			);
		}

		// Versioned template admin routes — only when a token is configured and a
		// store is present (db templates). Mirrors @fonderie/config's admin surface.
		if (this.config.adminToken) {
			if (!store) {
				throw new Error('[courier] adminToken requires @fonderie/store (db templates)');
			}
			for (const [method, path, handler] of buildTemplateAdminRoutes(store, this.config.adminToken)) {
				app.addRoute(method, path, handler);
			}
		}
	}
}

function createTemplateResolver(
	source: 'db' | 'fs',
	config: ICourierConfig,
	store?: IStoreAdapter,
): ITemplateResolver {
	// Aggregate the module-shipped defaults (one map or an array) into a single
	// lookup, mirroring how getMigrationsPath() results are collected at boot.
	const input = config.templates?.defaults;
	const defaults = new DefaultTemplates(input ? (Array.isArray(input) ? input : [input]) : []);

	if (source === 'fs') {
		return new FSTemplateResolver(config.templates?.directory ?? './templates', defaults);
	}

	if (!store) {
		throw new Error('[courier] store is required for DB template resolution');
	}

	return new DBTemplateResolver(store, defaults);
}
