<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-webhooks — signatures

## @fonderie/react-native-webhooks

```ts
new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

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
    payload: Record<string, unknown>;
    responseStatus: number | null;
    responseBody: string | null;
    nextAttemptAt: string | null;
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
  .listEndpoints(opts?: IReadOptions | undefined): Promise<IApiResponse<IWebhookEndpointListResult>>
  .createEndpoint(input: ICreateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointCreatedDTO>>
  .getEndpoint(endpointId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IWebhookEndpointDTO>>
  .updateEndpoint(endpointId: string, input: IUpdateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointDTO>>
  .deleteEndpoint(endpointId: string): Promise<undefined>
  .listDeliveries(endpointId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IWebhookDeliveryListResult>>
  .testEndpoint(endpointId: string): Promise<IApiResponse<ITestWebhookResult>>

interface IUseWebhookDeliveriesReturn {
    deliveries: IWebhookDeliveryDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    testEndpoint: () => Promise<ITestWebhookResult>;
}

interface IUseWebhookEndpointReturn {
    endpoint: IWebhookEndpointDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    updateEndpoint: (input: IUpdateWebhookEndpointInput) => Promise<void>;
}

interface IUseWebhookEndpointsReturn {
    endpoints: IWebhookEndpointDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createEndpoint: (input: ICreateWebhookEndpointInput) => Promise<IWebhookEndpointCreatedDTO>;
    removeEndpoint: (endpointId: string) => Promise<void>;
    testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
}

function useWebhookDeliveries(endpointId: string): IUseWebhookDeliveriesReturn

function useWebhookEndpoint(endpointId: string): IUseWebhookEndpointReturn

function useWebhookEndpoints(client?: WebhooksClient | undefined): IUseWebhookEndpointsReturn
```
