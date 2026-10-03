<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react — signatures

## @fonderie/react

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
  .queries: QueryStore
  .session: SessionState
  .onSessionChange(listener: (state: SessionState) => void): () => void
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .getWorkspaceId(): string | undefined
  .onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; token?: string | undefined; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<...>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

interface IFonderieProviderProps {
    client: FonderieClient;
    children?: ReactNode;
}

interface IWorkspaceScoped {
    getWorkspaceId(): string | undefined;
    onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void;
}

function FonderieProvider({ client, children }: IFonderieProviderProps): FunctionComponentElement<ProviderProps<FonderieClient | null>>

function useFonderieClient(): FonderieClient

function useFonderieSubClient<T>(explicit: T | undefined, select: (client: FonderieClient) => T, hookName: string): T

function useWorkspaceId(source?: unknown): string | undefined

new ConfigClient(http: HttpClient, tokens: TokenStore, sse?: SseClient | undefined, options?: IConfigClientOptions | undefined): ConfigClient
  .ready: Promise<void>
  .retain(): () => void
  .load(): Promise<IRemoteConfigState>
  .get<T>(key: string, fallback: T): T
  .snapshot(): IRemoteConfigState
  .subscribe(listener: Listener): () => void

interface IAuthErrorInfo {
    reason: 'revoked' | 'expired' | 'no-refresh-token';
    detail?: string;
}

interface IClientLog {
    warn(message: string): void;
}

interface IConfigStorage {
    getItem(key: string): string | null | undefined | Promise<string | null | undefined>;
    setItem(key: string, value: string): void | Promise<void>;
}

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

type SessionState = 'signedOut' | 'active' | 'offline' | 'revoked';

new SseClient(deps: ISseClientDeps): SseClient
  .identityChanged(): void
  .status: SseStatus
  .onStatus(listener: (status: SseStatus) => void): () => void
  .subscribe(topics: string[], onEvent: (event: ISseClientEvent) => void, options?: ISseSubscribeOptions | undefined): () => void
  .pause(): void
  .resume(): void

type SseStatus = 'idle' | 'connecting' | 'open' | 'paused' | 'unavailable';

function isSwitchOn(value: unknown): boolean

function toApiError(err: unknown): FonderieApiError

function useClientQuery<T>(source: object, key: string | null, fetcher: (ctx: { force: boolean; }) => Promise<T>, opts?: IUseClientQueryOptions): IClientQueryResult<T>

function useRemoteConfig<T>(key: string, fallback: T, client?: ConfigClient | undefined): T

function useScopedQuery<T>(source: object, path: string, read: (bust: boolean) => Promise<T>, opts?: IScopedQueryOptions<T>): IScopedQuery<T>

function useSse(topics: string[], onEvent: (event: ISseClientEvent) => void, options?: IUseSseOptions, client?: SseClient | undefined): void

function useSseStatus(client?: SseClient | undefined): SseStatus

function useWrite(after?: (() => Promise<void>) | undefined): { error: FonderieApiError | null; run: <R>(write: () => Promise<R>) => Promise<R>; }

function withRemoteConfig<P extends object>(key: string, Component: ComponentType<P>, options?: IWithRemoteConfigOptions<P>): ComponentType<P>

interface IScopedQuery<T> {
    data: T | undefined;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    adopt: (data: T) => void;
    key: string;
}

interface IScopedQueryOptions<T> {
    normal?: (err: FonderieApiError) => T | undefined;
    perWorkspace?: boolean;
    enabled?: boolean;
}

interface IClientQueryResult<T> {
    data: T | undefined;
    error: unknown;
    isLoading: boolean;
    isFetching: boolean;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<T | undefined>;
}

interface IUseClientQueryOptions {
    staleMs?: number;
    enabled?: boolean;
}

interface IUseSseOptions {
    onReset?: () => void;
}

interface IWithRemoteConfigOptions<P> {
    off?: ComponentType<P> | null;
    fallback?: boolean;
}
```
