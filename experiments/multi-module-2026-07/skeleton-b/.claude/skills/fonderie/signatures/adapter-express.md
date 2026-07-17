<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/adapter-express — signatures

## @fonderie/adapter-express

```ts
function expressRequestToWeb(req: ExpressRequest): Promise<Request>

function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void>

function bridge(fonderie: FonderieApp): (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext) => Promise<void>

function adapt(middleware: Middleware): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function withWorkspace(store: IStoreAdapter): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function requirePermission(operation: Operation, permissionKey: string): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function requireFeature(key: string): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function mount<T extends ExpressApp>(app: T, fonderie: FonderieApp, register?: ((app: T) => void) | undefined): T

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

type ExpressRequest = IncomingMessage & {
    body?: unknown;
    _fonderie?: IFonderieContext;
};

type ExpressResponse = ServerResponse;

type ExpressNext = (err?: unknown) => void;

function requireAuth(req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void>
```
