<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/adapter-koa — signatures

## @fonderie/adapter-koa

```ts
function koaContextToWeb(ctx: KoaContext, maxBytes?: number): Promise<Request>

function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void>

function bridge(fonderie: FonderieApp, options?: { maxBodyBytes?: number; }): KoaMiddleware<any, any>

function adapt(middleware: Middleware): KoaMiddleware<any, any>

function withWorkspace(store: IStoreAdapter): KoaMiddleware<any, any>

function requirePermission(operation: Operation, permissionKey: string): KoaMiddleware<any, any>

function requireFeature(key: string): KoaMiddleware<any, any>

function mount(app: Application<DefaultState, DefaultContext>, fonderie: FonderieApp, options?: { maxBodyBytes?: number; }): Application<DefaultState, DefaultContext>

function cors(options?: CorsOptions | undefined): KoaMiddleware<any, any>

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

interface KoaContext {
    request: {
        url: string;
        method: string;
        rawBody?: string;
        headers: Record<string, string | string[] | undefined>;
    };
    response: {
        body: unknown;
        status: number;
        set(key: string, value: string | string[]): void;
    };
    req: IncomingMessage;
    state: Record<string, unknown>;
}

type KoaNext = () => Promise<void>;

const DEFAULT_MAX_BODY_BYTES: number

function requireAuth(context: any, next: Next): any
```
