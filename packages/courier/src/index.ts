export { CourierModule } from './module';
// Production-readiness — warn on message types routed to a channel with no
// provider. Runs automatically at boot (CourierModule.install); exported for an
// app's own preflight.
export { validateCourierConfig } from './config-guard';
export { handleSendGridDelivery, handleMailgunDelivery, handleMailtrapDelivery } from './delivery';
export { Dispatcher } from './dispatcher';
export { SmsChannel } from './channels/sms';
export { PushChannel } from './channels/push';
export { EmailChannel } from './channels/email';
export { DBTemplateResolver, FSTemplateResolver } from './templates/resolver';
// Versioned template management (on the @fonderie/store primitive): edit with
// optimistic concurrency, revision history, rollback. The resolver is unchanged.
export {
	setTemplate,
	rollbackTemplate,
	listTemplateRevisions,
	getTemplateEntry,
	listTemplateEntries,
} from './templates/admin';
export type { ITemplateEntry, ITemplateRevision } from './templates/admin';
export type { IMessageLog, MessageLogStatus } from './log';
export type {
	ICourierMessage,
	ICourierChannel,
	IRenderedTemplate,
	ITemplateResolver,
} from './types';
export { Channel } from './config';
export type {
	ICourierConfig,
	IEmailChannelConfig,
	ISmsChannelConfig,
	IPushChannelConfig,
} from './config';
