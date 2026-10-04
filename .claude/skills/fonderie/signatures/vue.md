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
  .queries: QueryStore
  .session: SessionState
  .onSessionChange(listener: (state: SessionState) => void): () => void
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .setLocale(tag: string): void
  .getLocale(): string
  .onLocaleChange(listener: (tag: string) => void): () => void
  .getWorkspaceId(): string | undefined
  .onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; token?: string | undefined; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<...>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

interface IWorkspaceScoped {
    getWorkspaceId(): string | undefined;
    onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void;
}

const FONDERIE_INJECTION_KEY: InjectionKey<FonderieClient>

const FonderiePlugin: Plugin<[FonderieClient]>

function provideFonderie(client: FonderieClient): void

function useFonderieClient(): FonderieClient

function useFonderieSubClient<T>(explicit: T | undefined, select: (client: FonderieClient) => T, composableName: string): T

function useWorkspaceId(source?: unknown): Readonly<Ref<string | undefined, string | undefined>>

function useUiError(source?: object | undefined, locale?: MaybeRefOrGetter<string | undefined>): (error: IApiErrorLike | null | undefined) => string

function useUiLocale(source?: object | undefined, locale?: MaybeRefOrGetter<string | undefined>): Readonly<Ref<string, string>>

function useUiT(source?: object | undefined, locale?: MaybeRefOrGetter<string | undefined>): UiT

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

type UiMessageKey = MessagePath<UiMessages>;

type UiT = (key: UiMessageKey, params?: UiMessageParams) => string;

function toApiError(err: unknown): FonderieApiError

function useClientQuery<T>(source: object, key: () => string | null, fetcher: (ctx: { force: boolean; }) => Promise<T>, opts?: IUseClientQueryOptions): IClientQueryResult<T>

function usePagedQuery<Row, Cursor>(source: object, path: string | (() => string), readFirst: (bust: boolean) => Promise<IPage<Row, Cursor>>, readMore: (next: Cursor) => Promise<IPage<Row, Cursor>>, opts?: IScopedQueryOptions<...> & { ...; }): IPagedQuery<...>

function useRemoteConfig<T>(key: MaybeRefOrGetter<string>, fallback: T, client?: ConfigClient | undefined): ComputedRef<T>

function useScopedQuery<T>(source: object, path: string | (() => string), read: (bust: boolean) => Promise<T>, opts?: IScopedQueryOptions<T>): IScopedQuery<T>

function useSse(topics: MaybeRefOrGetter<string[]>, onEvent: (event: ISseClientEvent) => void, options?: IUseSseOptions, client?: SseClient | undefined): void

function useSseStatus(client?: SseClient | undefined): Readonly<Ref<SseStatus, SseStatus>>

function useWrite(after?: (() => Promise<void>) | undefined): { error: Ref<FonderieApiError | null, FonderieApiError | null>; run: <R>(write: () => Promise<...>) => Promise<...>; }

function withRemoteConfig(key: string, component: Component, options?: IWithRemoteConfigOptions): Component

interface IPage<Row, Cursor> {
    rows: Row[];
    next: Cursor | null;
    total?: number;
}

interface IPagedQuery<Row> {
    rows: ComputedRef<Row[]>;
    total: ComputedRef<number | undefined>;
    hasMore: ComputedRef<boolean>;
    isLoading: ComputedRef<boolean>;
    isLoadingMore: Ref<boolean>;
    error: ComputedRef<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IScopedQuery<T> {
    data: ComputedRef<T | undefined>;
    isLoading: ComputedRef<boolean>;
    error: ComputedRef<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    adopt: (data: T) => void;
}

interface IScopedQueryOptions<T> {
    normal?: (err: FonderieApiError) => T | undefined;
    perWorkspace?: boolean;
    enabled?: boolean | (() => boolean);
}

interface IClientQueryResult<T> {
    data: ComputedRef<T | undefined>;
    error: ComputedRef<unknown>;
    isLoading: ComputedRef<boolean>;
    isFetching: ComputedRef<boolean>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<T | undefined>;
}

interface IUseClientQueryOptions {
    staleMs?: number;
}

interface IUseSseOptions {
    onReset?: () => void;
}

interface IWithRemoteConfigOptions {
    off?: Component | null;
    fallback?: boolean;
}
```
