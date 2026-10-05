<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/events — signatures

## @fonderie/events

Subpath exports: `@fonderie/events/migrations`, `@fonderie/events/env.json`

```ts
new EventBus(transport: IEventTransport): EventBus
  .emit<T = unknown>(type: string, payload: T, opts?: { requestId?: string; } | undefined): Promise<void>
  .on<T = unknown>(type: string, handler: IEventHandler<T>, consumer?: string): void
  .start(): Promise<void>
  .drain(options?: { maxMs?: number; } | undefined): Promise<void>
  .stop(): Promise<void>

new EventsModule(config: IEventsConfig): EventsModule
  .name: "@fonderie/events"
  .version: string
  .bus: EventBus
  .describeAdmin(): IAdminDescription
  .stop(): Promise<void>
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
    consume?: boolean;
    claimTimeoutMs?: number;
    integrityKey?: string;
    retiredIntegrityKeys?: string[];
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
  .drain(options?: { maxMs?: number; }): Promise<void>
  .storeForIntegrity(): IStoreAdapter | null
  .integrityKeyProblem(): "too-short" | "placeholder" | null
  .hasIntegrityKey(): boolean
  .verifyIntegrity(): Promise<IIntegrityReport | null>
  .deadLetters(limit?: number): Promise<IDeadLetter[]>
  .retryDead(eventId: string, consumer: string): Promise<boolean>
  .dismissDead(eventId: string, consumer: string): Promise<boolean>
  .pendingByConsumer(): Promise<IConsumerBacklog[]>
  .pendingCount(): Promise<number>

function explainDrainFailure(err: unknown): string

function explainListenFailure(err: unknown): string

function runWorker(buses: EventBus | EventBus[], options?: IRunWorkerOptions): Promise<IWorkerHandle>

interface IRunWorkerOptions {
    maxMs?: number;
    intervalMs?: number;
    port?: number;
    secret?: string;
    once?: boolean;
    onError?: (err: unknown) => void;
}

interface IWorkerHandle {
    readonly done: Promise<void>;
    stop(): Promise<void>;
    readonly port?: number;
}

interface IEventTransport {
    publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>;
    subscribe(type: string, handler: IEventHandler, consumer: string): void;
    start(): Promise<void>;
    drain?(options?: {
        maxMs?: number;
    }): Promise<void>;
    stop(): Promise<void>;
}

interface IPGTransportConfig {
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
    consume?: boolean;
    claimTimeoutMs?: number;
    integrityKey?: string;
    retiredIntegrityKeys?: string[];
}

interface IDeadLetter {
    eventId: string;
    consumer: string;
    type: string;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
}

interface IConsumerBacklog {
    consumer: string;
    waiting: number;
    oldestMinutes: number;
}

function matchesPattern(pattern: string, eventType: string): boolean

function computeEventHmac(key: string, event: IHashableEvent): string

function verifyEventChain(store: IStoreAdapter, key: string, retiredKeys?: readonly string[]): Promise<IIntegrityReport>

function canonicalize(value: unknown): string

function startIntegrityCheck(store: IStoreAdapter, key: string, options?: IIntegrityCheckOptions): IIntegrityCheckHandle

interface IIntegrityCheckOptions {
    intervalMs?: number;
    onResult?: (report: IIntegrityReport) => void;
    onTamper?: (report: IIntegrityReport) => void;
    retiredKeys?: readonly string[];
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
    retiredKey: number;
    tampered: string[];
}

function accountEraser(store: IStoreAdapter, options?: IEventsEraserOptions): IEventsAccountEraser

interface IEventsAccountEraser {
    readonly name: 'events';
    erase(subject: IEventsErasureSubject): Promise<IEventsErasureResult>;
}

interface IEventsEraserOptions {
    integrityKey?: string;
    retiredIntegrityKeys?: readonly string[];
}

interface IEventsErasureResult {
    erased: number;
    kept?: string;
}

interface IEventsErasureSubject {
    userId: string;
    email: string | null;
    phone: string | null;
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
    erasedAt?: string;
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
    status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead' | 'dismissed';
    attempts: number;
    error: string | null;
    processedAt: Date | null;
}

const NOTIFICATION_EVENT: "fonderie.notification.send"

type NotificationEvent = typeof NOTIFICATION_EVENT;
```
