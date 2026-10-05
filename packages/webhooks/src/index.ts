export { WebhooksModule } from './module';
export type { IWebhooksConfig } from './config';
export type {
	IWebhookEndpoint,
	IWebhookDelivery,
	DeliveryStatus,
	IBinnedEndpoint,
} from './types';
export type {
	IWebhookEndpointDTO,
	IWebhookEndpointCreatedDTO,
	IWebhookDeliveryDTO,
	IBinnedEndpointDTO,
} from './dtos/webhook';

// Request validation — enforced contract for body-taking routes; exported
// for docs generation and typed clients.
export * as schemas from './schemas';

// Account deletion — the purge redacts the person from delivery records.
export { accountEraser } from './eraser';
export { BIN_RETENTION_DAYS, emptyEndpointBin } from './models/endpoint.model';
export type { IWebhooksAccountEraser, IWebhooksErasureResult, IWebhooksErasureSubject } from './eraser';

// SSRF guard — reject webhook URLs that resolve to non-public addresses.
// Exported so consumers can pre-validate a URL before registering it.
export { assertPublicHttpUrl, isBlockedAddress, resolvePinnedTarget, pinnedTransport, SsrfError } from './ssrf';
export type { IPinnedTarget, IWebhookResponse, WebhookTransport } from './ssrf';

// Who changed the webhooks (docs/INSIDER-THREAT-DESIGN.md, Phase 6)
export { WEBHOOK_EVENTS } from './middlewares/trail';

