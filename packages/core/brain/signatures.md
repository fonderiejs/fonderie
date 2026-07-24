<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/core — signatures

## @fonderie/core

Subpath exports: `@fonderie/core/config`, `@fonderie/core/types`, `@fonderie/core/middlewares`, `@fonderie/core/parser`, `@fonderie/core/response`

```ts
interface ITenant {
    id: string;
    slug: string;
    plan: string;
}

interface IRouter {
    match(method: string, path: string): IRouteMatch | null;
    add(method: string, path: string, handler: Middleware): void;
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

interface IFonderieApp {
    use(middleware: Middleware): IFonderieApp;
    register(module: IFonderieModule): IFonderieApp;
    addRoute(method: string, path: string, ...handlers: Middleware[]): void;
    listen(port: number, options?: {
        name?: string;
        version?: string;
        env?: string;
    }): void;
}

interface IFonderieModule {
    name: string;
    deps?: string[];
    install(app: IFonderieApp): void | Promise<void>;
}

interface IFonderieContext {
    request: Request;
    meta: IFonderieContextMeta;
    readonly tenant: ITenant | null;
    readonly user: IAuthUser | null;
    readonly workspace: IWorkspace | null;
    _router: IRouter;
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

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

new FonderieApp(config: FonderieConfig): FonderieApp
  .listen(port: number, options?: { name?: string; version?: string; env?: string; quiet?: boolean; }): Server<typeof IncomingMessage, typeof ServerResponse>
  .register(module: IFonderieModule): FonderieApp
  .boot(): Promise<FonderieApp>
  .buildContext(request: Request): Promise<IFonderieContext>
  .use(middleware: Middleware): FonderieApp
  .addRoute(method: string, path: string, ...handlers: Middleware[]): void
  .handle(request: Request): Promise<Response>

function defineConfig(config: FonderieConfig): FonderieConfig

function compose(middlewares: Middleware[]): (ctx: IFonderieContext, fallback: () => Promise<Response>) => Promise<Response>

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

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
}

type HttpStatus = (typeof HTTP)[keyof typeof HTTP];

const HTTP: { readonly OK: 200; readonly CREATED: 201; readonly ACCEPTED: 202; readonly NO_CONTENT: 204; readonly BAD_REQUEST: 400; readonly UNAUTHORIZED: 401; readonly PAYMENT_REQUIRED: 402; readonly FORBIDDEN: 403; readonly NOT_FOUND: 404; readonly CONFLICT: 409; readonly GONE: 410; readonly UNPROCESSABLE: 422; readonly TOO_MANY_REQUESTS: 429; readonly SERVER_ERROR: 500; readonly NOT_IMPLEMENTED: 501; readonly BAD_GATEWAY: 502; readonly SERVICE_UNAVAILABLE: 503; }

function setApiResponse<T>(status: number, reason: string, explanation: string, payload?: T | undefined): Response
```
