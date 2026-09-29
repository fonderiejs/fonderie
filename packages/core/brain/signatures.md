<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/core — signatures

## @fonderie/core

Subpath exports: `@fonderie/core/config`, `@fonderie/core/types`, `@fonderie/core/middlewares`, `@fonderie/core/parser`, `@fonderie/core/response`, `@fonderie/core/env.json`

```ts
interface IAdminCheck {
    name: string;
    run(): Promise<IAdminCheckReport>;
}

interface IAdminCheckReport {
    ok: boolean;
    findings: Array<string | IFinding>;
    skipped?: string | IFinding;
}

interface IAdminDescription {
    routes?: IAdminRoute[];
    checks?: IAdminCheck[];
}

interface IAdminDescriptionEntry {
    module: string;
    description: IAdminDescription;
}

interface IAdminRoute {
    method: string;
    path: string;
    handlers: Middleware[];
}

interface ITenant {
    id: string;
    slug: string;
    plan: string;
}

interface IRouter {
    match(method: string, path: string): IRouteMatch | null;
    add(method: string, path: string, handler: Middleware, module?: string): void;
    reserve(prefix: string, module?: string): void;
    list(): IRouteEntry[];
}

type Operation = 'create' | 'read' | 'update' | 'delete';

interface IAuthUser {
    id: string;
    email: string | null;
    phone: string | null;
    suspended: boolean;
    mfaEnabled: boolean;
    deletedAt: Date | null;
    emailVerifiedAt: Date | null;
    loginMethod: 'email' | 'phone' | 'google';
    phoneVerified: boolean;
    mfaPending?: boolean;
    locale: string;
}

type Middleware = (ctx: IFonderieContext, next: () => Promise<Response>) => Promise<Response>;

interface IWorkspace {
    id: string;
    name: string;
    isPersonal?: boolean;
}

interface IRouteMatch {
    handler: Middleware;
    params: Record<string, string>;
}

interface IRouteEntry {
    method: string;
    path: string;
    module?: string;
}

interface IFonderieApp {
    use(middleware: Middleware): IFonderieApp;
    register(module: IFonderieModule): IFonderieApp;
    addRoute(method: string, path: string, ...handlers: Middleware[]): void;
    reserve(prefix: string): void;
    routes(): IRouteEntry[];
    listen(port: number, options?: {
        name?: string;
        version?: string;
        env?: string;
    }): void;
    boot(): Promise<IFonderieApp>;
    checkProductionReadiness(): IReadinessReport;
    securityReport(): ISecurityReport;
    adminDescriptions(): IAdminDescriptionEntry[];
    readonly locales?: ILocaleSettings;
}

interface IFonderieModule {
    name: string;
    version?: string;
    deps?: string[];
    install(app: IFonderieApp): void | Promise<void>;
    checkReadiness?(): IReadinessProblem[];
    stop?(): void | Promise<void>;
    describeAdmin?(): IAdminDescription;
}

interface IFonderieContext {
    request: Request;
    meta: IFonderieContextMeta;
    readonly tenant: ITenant | null;
    readonly user: IAuthUser | null;
    readonly workspace: IWorkspace | null;
}

interface ICourierMessage {
    type: string;
    locale?: string;
    recipient: {
        email: string | null;
        phone: string | null;
        deviceToken: string | null;
    };
    data: Record<string, unknown>;
}

interface IDefaultTemplate {
    subject?: string;
    text: string;
    html?: string;
    locales?: Readonly<Record<string, IDefaultTemplateCopy>>;
}

interface IFinding {
    message: string;
    reason?: string;
    domain?: string;
    metadata?: Readonly<Record<string, string | number>>;
    severity?: 'error' | 'advice';
}

interface IDefaultTemplateCopy {
    subject?: string;
    text: string;
    html?: string;
}

interface IFonderieContextMeta {
    params?: Record<string, string>;
    body?: unknown;
    clientIp?: string;
    workspaceId?: string;
    userId?: string;
    userWorkspaceRoles?: string[];
    message?: ICourierMessage;
    [key: string]: unknown;
}

interface IHandleInit {
    meta?: IFonderieContextMeta;
}

interface IReadinessProblem {
    module: string;
    severity: 'error' | 'warning';
    message: string;
    reason?: string;
    domain?: string;
    metadata?: Readonly<Record<string, string | number>>;
}

interface IReadinessReport {
    ok: boolean;
    problems: IReadinessProblem[];
}

interface ISecurityReport {
    generatedAt: string;
    env: string;
    registeredModules: string[];
    modules: Array<{
        name: string;
        version?: string;
    }>;
    readiness: IReadinessReport;
}

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

function background(work: Promise<unknown> | undefined): Promise<void>

function installPlatformBackgroundRunner(): Promise<boolean>

function setBackgroundRunner(fn: ((work: Promise<unknown>) => void) | null): void

function isServerlessRuntime(env?: ProcessEnv): boolean

function resolveBackgroundMode(env?: ProcessEnv): "await" | "detach"

type BackgroundMode = 'auto' | 'await' | 'detach';

new FonderieApp(config: FonderieConfig): FonderieApp
  .metrics: MetricsRegistry
  .locales: ILocaleSettings
  .listen(port: number, options?: { name?: string; version?: string; env?: string; quiet?: boolean; }): Server<typeof IncomingMessage, typeof ServerResponse>
  .register(module: IFonderieModule): FonderieApp
  .checkProductionReadiness(): IReadinessReport
  .securityReport(): ISecurityReport
  .shutdown(): Promise<void>
  .adminDescriptions(): IAdminDescriptionEntry[]
  .boot(): Promise<FonderieApp>
  .buildContext(request: Request): Promise<IFonderieContext>
  .use(middleware: Middleware): FonderieApp
  .addRoute(method: string, path: string, ...handlers: Middleware[]): void
  .reserve(prefix: string): void
  .routes(): IRouteEntry[]
  .handle(request: Request, init?: IHandleInit | undefined): Promise<Response>

const DEFAULT_MAX_BODY_BYTES: number

function defineConfig(config: FonderieConfig): FonderieConfig

interface ILocaleConfig {
    default?: string;
    fallbacks?: Record<string, string | readonly string[]>;
}

interface ILocaleSettings {
    readonly default: string;
    readonly fallbacks: Readonly<Record<string, readonly string[]>>;
}

const DEFAULT_SYSTEM_LOCALE: "en-US"

const MAX_LOCALE_FALLBACKS: 5

function canonicalLocale(tag: string | null | undefined): string | null

function defineLocales(config?: ILocaleConfig): ILocaleSettings

function localeChain(requested: string | null | undefined, settings: ILocaleSettings): string[]

function localeLanguage(tag: string): string

const SHIPPED_TEMPLATE_LANGUAGES: readonly string[]

function translationProblems(defaults: Readonly<Record<string, IDefaultTemplate>>, languages?: readonly string[]): string[]

function withTranslations<K extends string>(english: Record<K, IDefaultTemplate>, translations: Record<string, Record<K, IDefaultTemplateCopy>>): Record<...>

function compose(middlewares: Middleware[]): (ctx: IFonderieContext, fallback: () => Promise<Response>) => Promise<Response>

function normalizeMountPath(path: string): string

function normalizeRequestPath(path: string): string

interface FonderieConfig {
    basePath?: string;
    db: {
        url: string;
    };
    billing?: {
        provider: 'stripe';
        plans: IBillingPlan[];
        stripeSecretKey: string;
    };
    email?: {
        from: string;
        apiKey?: string;
        smtp?: ISMTPConfig;
        provider: 'resend' | 'ses' | 'smtp';
    };
    locales?: ILocaleConfig;
    skipProductionReadinessGate?: boolean;
    healthChecks?: boolean;
    readyProbe?: () => boolean | Promise<boolean>;
    exposeReadyzDetails?: boolean;
    metrics?: boolean;
    maxBodyBytes?: number;
    onError?: (err: unknown) => Response;
    onResponse?: (body: unknown, info: {
        status: number;
        request: Request;
    }) => unknown;
}

function stringOrEmpty(value: unknown): string

function booleanOrFalse(value: unknown): boolean

function arrayOrEmpty<T>(value: unknown): T[]

function numberOrZero(value: unknown): number

function dateOrEmpty(value: unknown): string

function constantTimeEqual(a: string | Buffer<ArrayBufferLike>, b: string | Buffer<ArrayBufferLike>): boolean

const MIN_SECRET_LENGTH: 32

const PLACEHOLDER_SECRET: RegExp

function secretStrengthProblem(secret: string): "too-short" | "placeholder" | null

function encodeKeysetCursor(createdAt: string, id: string): string

function decodeKeysetCursor(cursor: string): { createdAt: string; id: string; } | null

interface ISseEvent {
    id?: string;
    event?: string;
    data: unknown;
}

interface ISseOptions {
    heartbeatMs?: number;
    retryMs?: number;
    headers?: Record<string, string>;
    maxLifetimeMs?: number;
}

interface ISseStream {
    send(event: ISseEvent): void;
    comment(text: string): void;
    close(): void;
    readonly closed: boolean;
}

const SSE_CONTENT_TYPE: "text/event-stream"

function formatSseEvent(event: ISseEvent): string

function isEventStream(response: Response): boolean

function sseResponse(signal: AbortSignal | undefined, onOpen: (stream: ISseStream) => Cleanup, options?: ISseOptions): Response

function abortOnDisconnect(res: ServerResponse<IncomingMessage> | undefined): AbortSignal | undefined

function pipeWebBody(body: ReadableStream<Uint8Array<ArrayBufferLike>>, res: ServerResponse<IncomingMessage>): Promise<...>

function writeWebHead(webRes: Response, res: ServerResponse<IncomingMessage>): void

function writeWebResponse(webRes: Response, res: ServerResponse<IncomingMessage>): Promise<void>

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
}

type HttpStatus = (typeof HTTP)[keyof typeof HTTP];

const HTTP: { readonly OK: 200; readonly CREATED: 201; readonly ACCEPTED: 202; readonly NO_CONTENT: 204; readonly BAD_REQUEST: 400; readonly UNAUTHORIZED: 401; readonly PAYMENT_REQUIRED: 402; readonly FORBIDDEN: 403; readonly NOT_FOUND: 404; readonly CONFLICT: 409; readonly GONE: 410; readonly PAYLOAD_TOO_LARGE: 413; readonly UNPROCESSABLE: 422; readonly TOO_MANY_REQUESTS: 429; readonly SERVER_ERROR: 500; readonly NOT_IMPLEMENTED: 501; readonly BAD_GATEWAY: 502; readonly SERVICE_UNAVAILABLE: 503; }

function setApiResponse<T>(status: number, reason: string, explanation: string, payload?: T | undefined): Response

new MetricsRegistry(): MetricsRegistry
  .inc(name: string, labels?: Record<string, string>, by?: number): void
  .render(): string

function withMetrics(registry: MetricsRegistry): Middleware
```
