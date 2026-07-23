<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/adapter-koa — signatures

## @fonderie/adapter-koa

```ts
function koaContextToWeb(ctx: KoaContext): Request

function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void>

function bridge(fonderie: FonderieApp): KoaMiddleware<any, any>

function adapt(middleware: Middleware): KoaMiddleware<any, any>

function withWorkspace(store: IStoreAdapter): KoaMiddleware<any, any>

function requirePermission(operation: Operation, permissionKey: string): KoaMiddleware<any, any>

function requireFeature(key: string): KoaMiddleware<any, any>

function mount(app: Application<DefaultState, DefaultContext>, fonderie: FonderieApp): Application<DefaultState, DefaultContext>

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

function requireAuth(context: any, next: Next): any
```
