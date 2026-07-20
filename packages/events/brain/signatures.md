<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/events — signatures

## @fonderie/events

Subpath exports: `@fonderie/events/migrations`

```ts
new EventBus(transport: IEventTransport): EventBus
  .emit<T = unknown>(type: string, payload: T, opts?: { requestId?: string; } | undefined): Promise<void>
  .on<T = unknown>(type: string, handler: IEventHandler<T>, consumer?: string): void
  .start(): Promise<void>
  .stop(): Promise<void>

new EventsModule(config: IEventsConfig): EventsModule
  .name: "@fonderie/events"
  .bus: EventBus
  .install(_app: IFonderieApp): void

interface IEventsConfig {
    transport: EventTransportConfig;
}

type EventTransportConfig = {
    type: 'pg';
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
} | IEventTransport;

new MemoryTransport(): MemoryTransport
  .publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>
  .subscribe(pattern: string, handler: IEventHandler, _consumer: string): void
  .start(): Promise<void>
  .stop(): Promise<void>

new PGTransport(config: IPGTransportConfig): PGTransport
  .subscribe(pattern: string, handler: IEventHandler, consumer: string): void
  .publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>
  .start(): Promise<void>
  .stop(): Promise<void>

interface IEventTransport {
    publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>;
    subscribe(type: string, handler: IEventHandler, consumer: string): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}

interface IPGTransportConfig {
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
}

function matchesPattern(pattern: string, eventType: string): boolean

interface IEventMeta {
    id: string;
    type: string;
    emittedAt: string;
    attempts: number;
    requestId?: string;
}

type IEventHandler<T = unknown> = (payload: T, meta: IEventMeta) => Promise<void>;

interface IEventRecord {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    meta: IEventMeta;
    created_at: Date;
}

interface IConsumerRecord {
    event_id: string;
    consumer: string;
    status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead';
    attempts: number;
    error: string | null;
    processed_at: Date | null;
}

const NOTIFICATION_EVENT: "fonderie.notification.send"

type NotificationEvent = typeof NOTIFICATION_EVENT;
```
