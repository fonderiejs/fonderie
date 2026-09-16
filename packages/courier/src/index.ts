export { CourierModule } from './module';
// Production-readiness — warn on message types routed to a channel with no
// provider. Runs automatically at boot (CourierModule.install); exported for an
// app's own preflight.
export { validateCourierConfig } from './config-guard';
export { handleSendGridDelivery, handleMailgunDelivery, handleMailtrapDelivery } from './delivery';
export { Dispatcher } from './dispatcher';
export { messageStats } from './log';
export type { IMessageStats } from './log';
export { SmsChannel } from './channels/sms';
export { PushChannel } from './channels/push';
export { EmailChannel } from './channels/email';
export { DBTemplateResolver, FSTemplateResolver, DefaultTemplates, renderFragment } from './templates/resolver';
// Versioned template management (on the @fonderie/store primitive): edit with
// optimistic concurrency, revision history, rollback. The resolver is unchanged.
export {
	setTemplate,
	rollbackTemplate,
	listTemplateRevisions,
	getTemplateEntry,
	listTemplateEntries,
	deleteTemplate,
} from './templates/admin';
export { buildTemplateAdminRoutes } from './templates/admin-routes';
export type { ITemplateEntry, ITemplateRevision } from './templates/admin';
export type { IMessageLog, MessageLogStatus } from './log';
export type {
	ICourierMessage,
	ICourierChannel,
	IRenderedTemplate,
	ITemplateResolver,
	IDefaultTemplate,
	DefaultTemplateMap,
} from './types';
export { Channel } from './config';
export type {
	ICourierConfig,
	IEmailChannelConfig,
	ISmsChannelConfig,
	IPushChannelConfig,
} from './config';

// The sending domain's SPF/DKIM/DMARC live in public DNS, owned by whoever runs
// the domain — courier only declares a `from`. Nothing connects the two, and a
// mismatch is not a send failure: the RECEIVER drops or spam-files the message,
// so there is no bounce and no log. DNS-only by design, so it needs no provider
// API and no credentials and works for any SMTP backend.
export { checkSenderDns, describeSenderDnsProblems, senderDomain } from './sender-dns';
export type { ISenderDnsRecord, ISenderDnsReport, ResolveTxt } from './sender-dns';
