export { WebhooksModule } from './module';
export type { IWebhooksConfig } from './config';
export type {
	IWebhookEndpoint,
	IWebhookDelivery,
	DeliveryStatus,
} from './types';
export type {
	IWebhookEndpointDTO,
	IWebhookEndpointCreatedDTO,
	IWebhookDeliveryDTO,
} from './dtos/webhook';

// Request validation — enforced contract for body-taking routes; exported
// for docs generation and typed clients.
export * as schemas from './schemas';

// Account deletion — the purge redacts the person from delivery records.
export { accountEraser } from './eraser';
export type { IWebhooksAccountEraser, IWebhooksErasureResult, IWebhooksErasureSubject } from './eraser';

// SSRF guard — reject webhook URLs that resolve to non-public addresses.
// Exported so consumers can pre-validate a URL before registering it.
export { assertPublicHttpUrl, isBlockedAddress, resolvePinnedTarget, pinnedTransport, SsrfError } from './ssrf';
export type { IPinnedTarget, IWebhookResponse, WebhookTransport } from './ssrf';
