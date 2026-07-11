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
import { DBTemplateResolver, FSTemplateResolver } from './templates/resolver';
import { handleSendGridDelivery, handleMailgunDelivery, handleMailtrapDelivery } from './delivery';

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

	install(app: IFonderieApp): void {
		const store = this.store;
		const signingKeys = this.config.delivery?.signingKeys;

		app.addRoute('POST', '/courier/delivery/sendgrid', (ctx) =>
			handleSendGridDelivery(ctx.request, store!, signingKeys?.sendgrid),
		);
		app.addRoute('POST', '/courier/delivery/mailgun', (ctx) =>
			handleMailgunDelivery(ctx.request, store!, signingKeys?.mailgun),
		);
		app.addRoute('POST', '/courier/delivery/mailtrap', (ctx) =>
			handleMailtrapDelivery(ctx.request, store!),
		);
	}
}

function createTemplateResolver(
	source: 'db' | 'fs',
	config: ICourierConfig,
	store?: IStoreAdapter,
): ITemplateResolver {
	if (source === 'fs') {
		return new FSTemplateResolver(config.templates?.directory ?? './templates');
	}

	if (!store) {
		throw new Error('[courier] store is required for DB template resolution');
	}

	return new DBTemplateResolver(store);
}
