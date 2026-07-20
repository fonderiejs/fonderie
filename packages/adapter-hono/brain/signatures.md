<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/adapter-hono — signatures

## @fonderie/adapter-hono

```ts
function bridge(fonderie: FonderieApp): MiddlewareHandler

function adapt(middleware: Middleware): MiddlewareHandler

function withWorkspace(store: IStoreAdapter): MiddlewareHandler

function requirePermission(operation: Operation, permissionKey: string): MiddlewareHandler

function requireFeature(key: string): MiddlewareHandler

function mount(hono: Hono<BlankEnv, BlankSchema, "/">, fonderie: FonderieApp): Hono<BlankEnv, BlankSchema, "/">

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

type FonderieVariables = {
    _fonderie: IFonderieContext;
};

function requireAuth(c: Context<any, string, {}>, next: Next): Promise<void | Response>
```
