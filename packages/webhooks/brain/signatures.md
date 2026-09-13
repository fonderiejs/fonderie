<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/webhooks — signatures

## @fonderie/webhooks

Subpath exports: `@fonderie/webhooks/migrations`

```ts
new WebhooksModule(store: IStoreAdapter, config?: IWebhooksConfig, bus?: EventBus | undefined): WebhooksModule
  .name: "@fonderie/webhooks"
  .deps: string[]
  .install(app: IFonderieApp): void
  .retry(): Promise<void>
  .stop(): void

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
    payload: Record<string, unknown>;
    responseStatus: number | null;
    responseBody: string | null;
    nextAttemptAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
}

namespace schemas — exports: createEndpointSchema, updateEndpointSchema

function assertPublicHttpUrl(raw: string): Promise<void>

function isBlockedAddress(ip: string): boolean

function resolvePinnedTarget(raw: string): Promise<IPinnedTarget>

function pinnedTransport(url: string, init: { method: string; headers: Record<string, string>; body: string; timeoutMs?: number; }, maxResponseBytes?: number | undefined): Promise<IWebhookResponse>

new SsrfError(message?: string | undefined): SsrfError
new SsrfError(message?: string | undefined, options?: ErrorOptions | undefined): SsrfError
  .fonderieSsrf: true
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IPinnedTarget {
    url: URL;
    ip: string;
    family: 4 | 6;
}

interface IWebhookResponse {
    ok: boolean;
    status: number;
    body: string;
}

type WebhookTransport = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    timeoutMs?: number;
}, maxResponseBytes?: number) => Promise<IWebhookResponse>;
```
