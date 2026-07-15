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
