<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/sse — signatures

## @fonderie/sse

Subpath exports: `@fonderie/sse/pg`, `@fonderie/sse/env.json`

```ts
new SseModule(options?: ISseOptions): SseModule
  .name: "@fonderie/sse"
  .version: string
  .install(app: IFonderieApp): Promise<void>
  .stop(): Promise<void>

new InProcessBroadcaster(): InProcessBroadcaster
  .publish(message: ISseMessage): void
  .subscribe(onMessage: (message: ISseMessage) => void): () => void

function mayReceive(entry: IEventCatalogEntryWithModule, ctx: IFonderieContext, scope: IEventScope): Promise<boolean>

interface IBroadcaster {
    publish(message: ISseMessage): Promise<void> | void;
    subscribe(onMessage: (message: ISseMessage) => void): () => void;
    listen?(channel: string, onPayload: (payload: string) => void): Promise<() => void> | (() => void);
    start?(): Promise<void> | void;
    stop?(): Promise<void> | void;
}

interface ISseBus {
    on(type: string, handler: (payload: unknown, meta: {
        id: string;
        emittedAt?: string;
    }) => Promise<void> | void, consumer?: string): void;
}

interface ISseMessage {
    id: string;
    type: string;
    scope: IEventScope;
    data: Record<string, unknown>;
    at: string;
}

interface ISseOptions {
    bus?: ISseBus;
    broadcaster?: IBroadcaster;
    middlewares?: Middleware[];
    maxLifetimeMs?: number;
    heartbeatMs?: number;
    maxTopicsPerConnection?: number;
    maxConnectionsPerUser?: number;
    path?: string;
}
```
