import type { IFonderieModule, IFonderieApp, Middleware } from '@fonderie-js/core';
import type { IStoreAdapter }                             from '@fonderie-js/store';

import type { ITemplateResolver, ICourierMessage }        from './types';
import type { ICourierConfig }                            from './config';

import { Dispatcher }                                     from './dispatcher';
import { SmsChannel }                                     from './channels/sms';
import { PushChannel }                                    from './channels/push';
import { EmailChannel }                                   from './channels/email';
import { DBTemplateResolver, FSTemplateResolver }         from './templates/resolver';

export class CourierModule implements IFonderieModule {
	readonly name       = '@fonderie-js/courier'
	readonly dispatcher: Dispatcher

	constructor(
		private config: ICourierConfig,
		store?:         IStoreAdapter,
	) {
		const templateSource = config.templates?.source ?? 'db'
		const resolver       = createTemplateResolver(templateSource, config, store)

		this.dispatcher = new Dispatcher(config, resolver, store)

		if (config.email) this.dispatcher.registerChannel(new EmailChannel(config.email))
		if (config.sms)   this.dispatcher.registerChannel(new SmsChannel(config.sms))
		if (config.push)  this.dispatcher.registerChannel(new PushChannel(config.push))
	}

	install(app: IFonderieApp): void {
		const dispatcher = this.dispatcher

		const courierMiddleware: Middleware = async (ctx, next) => {
			const response = await next()

			const single   = ctx.meta['message']  as ICourierMessage | undefined
			const multiple = ctx.meta['messages'] as ICourierMessage[] | undefined

			const all: ICourierMessage[] = [
				...(single   ? [single]   : []),
				...(Array.isArray(multiple) ? multiple : []),
			]

			for (const msg of all) {
				dispatcher.dispatch(msg).catch(err =>
					console.error('[courier] dispatch error:', err)
				)
			}

			return response
		}

		app.use(courierMiddleware)
	}
}

function createTemplateResolver(
	source: 'db' | 'fs',
	config: ICourierConfig,
	store?: IStoreAdapter,
): ITemplateResolver {
	if (source === 'fs') {
		return new FSTemplateResolver(config.templates?.directory ?? './templates')
	}

	if (!store) {
		throw new Error('[courier] store is required for DB template resolution')
	}

	return new DBTemplateResolver(store)
}
