<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue — signatures

## @fonderie/vue

```ts
new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient
  .workspaces: WorkspacesClient
  .audit: AuditClient
  .webhooks: WebhooksClient
  .customers: CustomersClient
  .media: MediaClient
  .config: ConfigClient
  .sse: SseClient
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; token?: string | undefined; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<...>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

const FONDERIE_INJECTION_KEY: InjectionKey<FonderieClient>

const FonderiePlugin: Plugin<[FonderieClient]>

function provideFonderie(client: FonderieClient): void

function useFonderieClient(): FonderieClient

function useFonderieSubClient<T>(explicit: T | undefined, select: (client: FonderieClient) => T, composableName: string): T

new ConfigClient(http: HttpClient, tokens: TokenStore, sse?: SseClient | undefined): ConfigClient
  .hydrate(values: Readonly<Record<string, unknown>>): void
  .watch(): () => void
  .load(): Promise<IRemoteConfigState>
  .get<T>(key: string, fallback: T): T
  .snapshot(): IRemoteConfigState
  .subscribe(listener: Listener): () => void

interface IRemoteConfigState {
    values: Readonly<Record<string, unknown>>;
    loadedAt: Date | null;
    isLoading: boolean;
    error: unknown;
}

interface ISseClientEvent {
    id?: string;
    type: string;
    data: Record<string, unknown>;
    at?: string;
}

new SseClient(deps: ISseClientDeps): SseClient
  .status: SseStatus
  .onStatus(listener: (status: SseStatus) => void): () => void
  .subscribe(topics: string[], onEvent: (event: ISseClientEvent) => void, options?: ISseSubscribeOptions | undefined): () => void
  .pause(): void
  .resume(): void

type SseStatus = 'idle' | 'connecting' | 'open' | 'paused' | 'unavailable';

function useFlag<T>(key: MaybeRefOrGetter<string>, fallback: T, client?: ConfigClient | undefined): ComputedRef<T>

function useRemoteConfig(options?: IUseRemoteConfigOptions, client?: ConfigClient | undefined): IUseRemoteConfigReturn

function useSse(topics: MaybeRefOrGetter<string[]>, onEvent: (event: ISseClientEvent) => void, options?: IUseSseOptions, client?: SseClient | undefined): void

function useSseStatus(client?: SseClient | undefined): Readonly<Ref<SseStatus, SseStatus>>

interface IUseRemoteConfigOptions {
    refreshMs?: number;
    watch?: boolean;
}

interface IUseRemoteConfigReturn {
    state: Readonly<Ref<IRemoteConfigState>>;
    values: ComputedRef<Readonly<Record<string, unknown>>>;
    isLoading: ComputedRef<boolean>;
    error: ComputedRef<unknown>;
    refresh: () => Promise<IRemoteConfigState>;
}

interface IUseSseOptions {
    onReset?: () => void;
}
```
