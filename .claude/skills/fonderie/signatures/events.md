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
  .checkReadiness(): IReadinessProblem[]

interface IEventsConfig {
    transport: EventTransportConfig;
}

type EventTransportConfig = {
    type: 'pg';
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
    integrityKey?: string;
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
    integrityKey?: string;
}

function matchesPattern(pattern: string, eventType: string): boolean

function computeEventHmac(key: string, event: IHashableEvent): string

function verifyEventChain(store: IStoreAdapter, key: string): Promise<IIntegrityReport>

function canonicalize(value: unknown): string

function startIntegrityCheck(store: IStoreAdapter, key: string, options?: IIntegrityCheckOptions): IIntegrityCheckHandle

interface IIntegrityCheckOptions {
    intervalMs?: number;
    onResult?: (report: IIntegrityReport) => void;
    onTamper?: (report: IIntegrityReport) => void;
}

interface IIntegrityCheckHandle {
    stop: () => void;
}

interface IHashableEvent {
    id: string;
    type: string;
    payload: unknown;
    meta: unknown;
}

interface IIntegrityReport {
    ok: boolean;
    checked: number;
    unprotected: number;
    tampered: string[];
}

function purgeEvents(store: IStoreAdapter, { olderThanDays }: IPurgeEventsOptions): Promise<number>

function startEventRetention(store: IStoreAdapter, options: IRetentionScheduleOptions): { stop: () => void; }

interface IPurgeEventsOptions {
    olderThanDays: number;
}

interface IRetentionScheduleOptions extends IPurgeEventsOptions {
    intervalMs?: number;
    onPurge?: (deleted: number) => void;
}

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
    createdAt: Date;
}

interface IConsumerRecord {
    eventId: string;
    consumer: string;
    status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead';
    attempts: number;
    error: string | null;
    processedAt: Date | null;
}

const NOTIFICATION_EVENT: "fonderie.notification.send"

type NotificationEvent = typeof NOTIFICATION_EVENT;
```
