<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-webhooks — signatures

## @fonderie/vue-webhooks

```ts
interface ICreateWebhookEndpointInput {
    url: string;
    events?: string[];
}

interface ITestWebhookResult {
    status: number | null;
    ok: boolean;
    error?: string;
}

interface IUpdateWebhookEndpointInput {
    url?: string;
    events?: string[];
    enabled?: boolean;
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

interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
    secret: string;
}

interface IWebhookEndpointDTO {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    createdAt: string;
}

new WebhooksClient(http: HttpClient, tokens: TokenStore): WebhooksClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listEndpoints(): Promise<IApiResponse<IWebhookEndpointListResult>>
  .createEndpoint(input: ICreateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointCreatedDTO>>
  .getEndpoint(endpointId: string): Promise<IApiResponse<IWebhookEndpointDTO>>
  .updateEndpoint(endpointId: string, input: IUpdateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointDTO>>
  .deleteEndpoint(endpointId: string): Promise<undefined>
  .listDeliveries(endpointId: string): Promise<IApiResponse<IWebhookDeliveryListResult>>
  .testEndpoint(endpointId: string): Promise<IApiResponse<ITestWebhookResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useTestWebhookEndpoint(client: WebhooksClient): { testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>; isLoading: Ref<boolean, boolean>; error: Ref<...>; }

function useWebhookDeliveries(client: WebhooksClient, endpointId: string): { deliveries: Ref<{ id: string; eventId: string; eventType: string; status: string; attempts: number; responseStatus: number | null; deliveredAt: string | null; createdAt: string; }[], IWebhookDeliveryDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useWebhookEndpoint(client: WebhooksClient, endpointId: string): { endpoint: Ref<{ id: string; url: string; events: string[]; enabled: boolean; createdAt: string; } | null, IWebhookEndpointDTO | { ...; } | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; updateEndpoint: (input: IUpdateWebhookEndpointInput) => Promise<...>; }

function useWebhookEndpoints(client: WebhooksClient): { endpoints: Ref<{ id: string; url: string; events: string[]; enabled: boolean; createdAt: string; }[], IWebhookEndpointDTO[] | { ...; }[]>; ... 4 more ...; removeEndpoint: (endpointId: string) => Promise<...>; }
```
