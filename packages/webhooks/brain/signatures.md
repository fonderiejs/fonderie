<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/webhooks — signatures

## @fonderie/webhooks

Subpath exports: `@fonderie/webhooks/migrations`

```ts
new WebhooksModule(store: IStoreAdapter, config?: IWebhooksConfig, bus?: EventBus | undefined): WebhooksModule
  .name: "@fonderie/webhooks"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IWebhooksConfig {
    maxAttempts?: number;
    retryDelays?: number[];
    retryInterval?: number;
}

interface IWebhookEndpoint {
    id: string;
    workspaceId: string;
    url: string;
    secret: string;
    events: string[];
    enabled: boolean;
    createdAt: Date;
}

interface IWebhookDelivery {
    id: string;
    endpointId: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: DeliveryStatus;
    attempts: number;
    responseStatus: number | null;
    responseBody: string | null;
    nextAttemptAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
}

type DeliveryStatus = 'pending' | 'delivered' | 'failed';

interface IWebhookEndpointDTO {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    createdAt: string;
}

interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
    secret: string;
}

interface IWebhookDeliveryDTO {
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    attempts: number;
    responseStatus: number | null;
    deliveredAt: string | null;
    createdAt: string;
}

namespace schemas — exports: createEndpointSchema, updateEndpointSchema
```
