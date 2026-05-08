export { CourierModule }                          from './module';
export { Dispatcher }                             from './dispatcher';
export { SmsChannel }                             from './channels/sms';
export { PushChannel }                            from './channels/push';
export { EmailChannel }                           from './channels/email';
export { DBTemplateResolver, FSTemplateResolver } from './templates/resolver';
export { getMigrationsPath }                      from './migrations/index';

export type { IMessageLog, MessageLogStatus }        from './log';
export type {
	ICourierMessage, ICourierChannel,
	IRenderedTemplate, ITemplateResolver,
}                                                 from './types';
export type {
	ICourierConfig,
	IEmailChannelConfig, ISmsChannelConfig, IPushChannelConfig,
}                                                 from './config';
